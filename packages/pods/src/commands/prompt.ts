import { spawn } from "child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getCliCommand } from "../cli-command.js";
import { getActivePod, loadConfig } from "../config.js";
import { isValidPort } from "../process-identifiers.js";
import { extractHostFromSshCommand } from "../ssh.js";
import { createProviderName, findReservedFlag } from "./prompt-args.js";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

interface PromptOptions {
	pod?: string;
	apiKey?: string;
}

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const MONOREPO_CODING_AGENT_CLI = join(__dirname, "../../../coding-agent/src/cli.ts");
const PODS_AGENT_API_KEY_ENV = "PI_PODS_AGENT_API_KEY";

function resolveLocalCodingAgentCli(): string | undefined {
	if (existsSync(MONOREPO_CODING_AGENT_CLI)) {
		return MONOREPO_CODING_AGENT_CLI;
	}

	try {
		return require.resolve("@mariozechner/pi-coding-agent/dist/cli.js");
	} catch {
		return undefined;
	}
}

// ────────────────────────────────────────────────────────────────────────────────
// Main prompt function
// ────────────────────────────────────────────────────────────────────────────────

export async function promptModel(modelName: string, userArgs: string[], opts: PromptOptions = {}) {
	const cliCommand = getCliCommand();
	const reservedFlag = findReservedFlag(userArgs);
	if (reservedFlag) {
		throw new Error(
			`The ${reservedFlag} option is managed by "${cliCommand} agent". Select the target model with "${cliCommand} agent <name>" and pod with "--pod <name>".`,
		);
	}

	// Get pod and model configuration
	const activePod = (() => {
		if (opts.pod) {
			const config = loadConfig();
			const pod = config.pods[opts.pod];
			if (!pod) {
				return null;
			}
			return { name: opts.pod, pod };
		}
		return getActivePod();
	})();

	if (!activePod) {
		if (opts.pod) {
			throw new Error(`Pod '${opts.pod}' not found.`);
		}
		throw new Error(`No active pod. Use '${cliCommand} pods active <name>' to set one.`);
	}

	const { name: podName, pod } = activePod;
	const modelConfig = pod.models[modelName];

	if (!modelConfig) {
		throw new Error(`Model '${modelName}' not found on pod '${podName}'`);
	}

	if (!isValidPort(modelConfig.port)) {
		throw new Error(
			`Model '${modelName}' on pod '${podName}' has invalid port '${modelConfig.port}' in config. Expected integer 1-65535.`,
		);
	}

	// Extract host from SSH string using shell-aware parsing.
	const host = extractHostFromSshCommand(pod.ssh);
	if (!host) {
		throw new Error(
			`Pod '${podName}' has invalid SSH command '${pod.ssh}'. Expected format like: ssh [options] user@host`,
		);
	}

	// Build the system prompt for code navigation
	const systemPrompt = `You help the user understand and navigate the codebase in the current working directory.

You can read files, list directories, and execute shell commands via the respective tools.

Do not output file contents you read via the read_file tool directly, unless asked to.

Do not output markdown tables as part of your responses.

Keep your responses concise and relevant to the user's request.

File paths you output must include line numbers where possible, e.g. "src/index.ts:10-20" for lines 10 to 20 in src/index.ts.

Current working directory: ${process.cwd()}`;

	// Build arguments for agent main function
	const args: string[] = [];
	let tempExtensionDir: string | undefined;
	const resolvedApiKey = opts.apiKey || process.env.PI_API_KEY;
	if (!resolvedApiKey) {
		throw new Error(`Missing API key. Set PI_API_KEY before running "${cliCommand} agent ...".`);
	}
	const providerName = createProviderName();

	// Add base configuration that we control
	const api = modelConfig.model.toLowerCase().includes("gpt-oss") ? "openai-responses" : "openai-completions";
	const providerConfig = {
		baseUrl: `http://${host}:${modelConfig.port}/v1`,
		apiKey: PODS_AGENT_API_KEY_ENV,
		api,
		models: [
			{
				id: modelConfig.model,
				name: modelConfig.model,
				api,
				reasoning: false,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 131072,
				maxTokens: 16384,
			},
		],
	};

	tempExtensionDir = mkdtempSync(join(tmpdir(), "pi-pods-provider-"));
	const extensionPath = join(tempExtensionDir, "pods-provider.mjs");
	writeFileSync(
		extensionPath,
		`export default function (pi) { pi.registerProvider(${JSON.stringify(providerName)}, ${JSON.stringify(providerConfig)}); }\n`,
		"utf-8",
	);

	args.push(
		"--extension",
		extensionPath,
		"--provider",
		providerName,
		"--model",
		modelConfig.model,
		"--system-prompt",
		systemPrompt,
	);

	// Pass through all user-provided arguments
	// This includes messages, --continue, --json, etc.
	args.push(...userArgs);

	// Call agent main function directly
	const localCli = resolveLocalCodingAgentCli();
	const command = localCli?.endsWith(".ts") ? "npx" : localCli ? process.execPath : "npx";
	const commandArgs = localCli?.endsWith(".ts")
		? ["tsx", localCli, ...args]
		: localCli
			? [localCli, ...args]
			: ["--yes", "--package", "@mariozechner/pi-coding-agent", "pi", ...args];
	const childEnv = { ...process.env, [PODS_AGENT_API_KEY_ENV]: resolvedApiKey };
	try {
		await new Promise<void>((resolve, reject) => {
			const child = spawn(command, commandArgs, {
				stdio: "inherit",
				env: childEnv,
			});

			child.on("error", (error) => reject(error));
			child.on("exit", (code, signal) => {
				if (signal) {
					reject(new Error(`Agent process exited due to signal ${signal}`));
					return;
				}
				if (code === 0) {
					resolve();
					return;
				}
				reject(new Error(`Agent process exited with code ${code}`));
			});
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(
			[
				`Agent error: ${message}`,
				"Ensure npm can execute @mariozechner/pi-coding-agent (try: npx --yes --package @mariozechner/pi-coding-agent pi --help).",
			].join("\n"),
		);
	} finally {
		if (tempExtensionDir) {
			rmSync(tempExtensionDir, { recursive: true, force: true });
		}
	}
}
