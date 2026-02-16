import chalk from "chalk";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getActivePod, loadConfig } from "../config.js";

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
			console.error(chalk.red(`Pod '${opts.pod}' not found.`));
		} else {
			console.error(chalk.red("No active pod. Use 'pi pods active <name>' to set one."));
		}
		process.exit(1);
	}

	const { name: podName, pod } = activePod;
	const modelConfig = pod.models[modelName];

	if (!modelConfig) {
		console.error(chalk.red(`Model '${modelName}' not found on pod '${podName}'`));
		process.exit(1);
	}

	// Extract host from SSH string
	const host =
		pod.ssh
			.split(" ")
			.find((p) => p.includes("@"))
			?.split("@")[1] ?? "localhost";

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

	// Add base configuration that we control
	args.push(
		"--base-url",
		`http://${host}:${modelConfig.port}/v1`,
		"--model",
		modelConfig.model,
		"--api-key",
		opts.apiKey || process.env.PI_API_KEY || "dummy",
		"--api",
		modelConfig.model.toLowerCase().includes("gpt-oss") ? "responses" : "completions",
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
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, commandArgs, {
			stdio: "inherit",
			env: process.env,
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
	}).catch((err: unknown) => {
		const message = err instanceof Error ? err.message : String(err);
		console.error(chalk.red(`Agent error: ${message}`));
		console.error(
			chalk.yellow(
				"Ensure npm can execute @mariozechner/pi-coding-agent (try: npx --yes --package @mariozechner/pi-coding-agent pi --help).",
			),
		);
		process.exit(1);
	});
}
