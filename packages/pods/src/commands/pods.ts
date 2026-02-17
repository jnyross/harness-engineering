import chalk from "chalk";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getCliCommand } from "../cli-command.js";
import { addPod, loadConfig, removePod, setActivePod } from "../config.js";
import { extractModelsPathFromMountCommand } from "../mount-command.js";
import { assertValidPodName } from "../pod-name.js";
import { shellQuote } from "../shell-quote.js";
import { scpFile, sshExec, sshExecStreamDetailed } from "../ssh.js";
import type { GPU, Pod } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseGpuQueryLine(line: string): GPU | undefined {
	const trimmed = line.trim();
	if (!trimmed) {
		return undefined;
	}

	const firstCommaIndex = trimmed.indexOf(",");
	if (firstCommaIndex === -1) {
		return undefined;
	}

	const idRaw = trimmed.slice(0, firstCommaIndex).trim();
	if (!idRaw || !/^\d+$/.test(idRaw)) {
		return undefined;
	}
	const parsedId = Number.parseInt(idRaw, 10);
	if (!Number.isSafeInteger(parsedId) || parsedId < 0) {
		return undefined;
	}

	const remainder = trimmed.slice(firstCommaIndex + 1).trim();
	if (!remainder) {
		return undefined;
	}

	let nameRaw: string | undefined;
	let memoryRaw: string | undefined;

	const memoryWithUnitMatch = remainder.match(/^(.*?),\s*((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?\s*[A-Za-z]+)$/);
	if (memoryWithUnitMatch) {
		nameRaw = memoryWithUnitMatch[1]?.trim();
		memoryRaw = memoryWithUnitMatch[2]?.trim();
	} else {
		const lastCommaIndex = remainder.lastIndexOf(",");
		if (lastCommaIndex === -1) {
			return undefined;
		}
		nameRaw = remainder.slice(0, lastCommaIndex).trim();
		memoryRaw = remainder.slice(lastCommaIndex + 1).trim();
	}

	return {
		id: parsedId,
		name: nameRaw || "Unknown",
		memory: memoryRaw || "Unknown",
	};
}

export function parseGpuQueryOutput(output: string): { gpus: GPU[]; skippedLines: string[] } {
	const gpus: GPU[] = [];
	const skippedLines: string[] = [];

	const lines = output
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	for (const line of lines) {
		const gpu = parseGpuQueryLine(line);
		if (gpu) {
			gpus.push(gpu);
			continue;
		}
		skippedLines.push(line);
	}

	return { gpus, skippedLines };
}

/**
 * List all pods
 */
export const listPods = () => {
	const cliCommand = getCliCommand();
	const config = loadConfig();
	const podNames = Object.keys(config.pods);

	if (podNames.length === 0) {
		console.log(`No pods configured. Use '${cliCommand} pods setup' to add a pod.`);
		return;
	}

	console.log("Configured pods:");
	for (const name of podNames) {
		const pod = config.pods[name];
		const isActive = config.active === name;
		const marker = isActive ? chalk.green("*") : " ";
		const gpuCount = pod.gpus?.length || 0;
		const gpuInfo = gpuCount > 0 ? `${gpuCount}x ${pod.gpus[0].name}` : "no GPUs detected";
		const vllmInfo = pod.vllmVersion ? ` (vLLM: ${pod.vllmVersion})` : "";
		console.log(`${marker} ${chalk.bold(name)} - ${gpuInfo}${vllmInfo} - ${pod.ssh}`);
		if (pod.modelsPath) {
			console.log(`    Models: ${pod.modelsPath}`);
		}
		if (pod.vllmVersion === "gpt-oss") {
			console.log(chalk.yellow(`    ⚠️  GPT-OSS build - only for GPT-OSS models`));
		}
	}
};

/**
 * Setup a new pod
 */
export const setupPod = async (
	name: string,
	sshCmd: string,
	options: { mount?: string; modelsPath?: string; vllm?: "release" | "nightly" | "gpt-oss" },
) => {
	try {
		assertValidPodName(name);
	} catch (error) {
		console.error(chalk.red(error instanceof Error ? error.message : String(error)));
		process.exit(1);
	}

	const cliCommand = getCliCommand();
	// Validate environment variables
	const hfToken = process.env.HF_TOKEN;
	const vllmApiKey = process.env.PI_API_KEY;

	if (!hfToken) {
		console.error(chalk.red("ERROR: HF_TOKEN environment variable is required"));
		console.error("Get a token from: https://huggingface.co/settings/tokens");
		console.error("Then run: export HF_TOKEN=your_token_here");
		process.exit(1);
	}

	if (!vllmApiKey) {
		console.error(chalk.red("ERROR: PI_API_KEY environment variable is required"));
		console.error("Set an API key: export PI_API_KEY=your_api_key_here");
		process.exit(1);
	}

	// Determine models path
	let modelsPath = options.modelsPath;
	if (!modelsPath && options.mount) {
		// Extract path from mount command if not explicitly provided.
		// e.g., "mount -t nfs ... /mnt/sfs" -> "/mnt/sfs"
		modelsPath = extractModelsPathFromMountCommand(options.mount);
	}

	if (!modelsPath) {
		console.error(chalk.red("ERROR: --models-path is required (or must be extractable from --mount)"));
		process.exit(1);
	}

	console.log(chalk.green(`Setting up pod '${name}'...`));
	console.log(`SSH: ${sshCmd}`);
	console.log(`Models path: ${modelsPath}`);
	console.log(
		`vLLM version: ${options.vllm || "release"} ${options.vllm === "gpt-oss" ? chalk.yellow("(GPT-OSS special build)") : ""}`,
	);
	if (options.mount) {
		console.log(`Mount command: ${options.mount}`);
	}
	console.log("");

	// Test SSH connection
	console.log("Testing SSH connection...");
	const testResult = await sshExec(sshCmd, "echo 'SSH OK'");
	const testSshError = getPodSetupSshError({ action: "Testing SSH connection", result: testResult });
	if (testSshError) {
		console.error(chalk.red(testSshError));
		process.exit(1);
	}
	console.log(chalk.green("✓ SSH connection successful"));

	// Copy setup script
	console.log("Copying setup script...");
	const scriptPath = join(__dirname, "../../scripts/pod_setup.sh");
	const copyResult = await scpFile(sshCmd, scriptPath, "/tmp/pod_setup.sh");
	if (!copyResult.ok) {
		console.error(chalk.red(`Failed to copy setup script${copyResult.error ? `: ${copyResult.error}` : ""}`));
		process.exit(1);
	}
	console.log(chalk.green("✓ Setup script copied"));

	// Build setup command
	const setupCmd = buildPodSetupCommand({
		modelsPath,
		hfToken,
		vllmApiKey,
		mount: options.mount,
		vllmVersion: options.vllm || "release",
	});

	// Run setup script
	console.log("");
	console.log(chalk.yellow("Running setup (this will take 2-5 minutes)..."));
	console.log("");

	// Use forceTTY to preserve colors from apt, pip, etc.
	const setupResult = await sshExecStreamDetailed(sshCmd, setupCmd, { forceTTY: true });
	if (setupResult.exitCode !== 0) {
		if (setupResult.error) {
			console.error(chalk.red(setupResult.error));
		}
		console.error(chalk.red("\nSetup failed. Check the output above for errors."));
		process.exit(1);
	}

	// Parse GPU info from setup output
	console.log("");
	console.log("Detecting GPU configuration...");
	const gpuResult = await sshExec(sshCmd, "nvidia-smi --query-gpu=index,name,memory.total --format=csv,noheader");
	const gpuDetectionError = getPodSetupSshError({ action: "Detecting GPU configuration", result: gpuResult });
	if (gpuDetectionError) {
		console.log(chalk.yellow(`⚠ ${gpuDetectionError}. Continuing with no detected GPUs.`));
	}

	const gpus: GPU[] = [];
	if (!gpuDetectionError && gpuResult.stdout) {
		const parsed = parseGpuQueryOutput(gpuResult.stdout);
		gpus.push(...parsed.gpus);
		if (parsed.skippedLines.length > 0) {
			console.log(
				chalk.yellow(
					`⚠ Skipped ${parsed.skippedLines.length} malformed GPU detection line(s) from nvidia-smi output.`,
				),
			);
		}
	}

	console.log(chalk.green(`✓ Detected ${gpus.length} GPU(s)`));
	for (const gpu of gpus) {
		console.log(`  GPU ${gpu.id}: ${gpu.name} (${gpu.memory})`);
	}

	// Save pod configuration
	const pod: Pod = {
		ssh: sshCmd,
		gpus,
		models: {},
		modelsPath,
		vllmVersion: options.vllm || "release",
	};

	addPod(name, pod);
	console.log("");
	console.log(chalk.green(`✓ Pod '${name}' setup complete and set as active pod`));
	console.log("");
	console.log("You can now deploy models with:");
	console.log(chalk.cyan(`  ${cliCommand} start <model> --name <name>`));
};

export function getPodSetupSshError(options: {
	action: string;
	result: { stdout: string; stderr: string; exitCode: number };
}): string | undefined {
	if (options.result.exitCode === 0) {
		return undefined;
	}

	const stderr = options.result.stderr.trim();
	if (stderr) {
		return `${options.action} failed: ${stderr}`;
	}

	const stdout = options.result.stdout.trim();
	if (stdout) {
		return `${options.action} failed: ${stdout}`;
	}

	return `${options.action} failed: SSH command exited with code ${options.result.exitCode}`;
}

export function buildPodSetupCommand(params: {
	modelsPath: string;
	hfToken: string;
	vllmApiKey: string;
	mount?: string;
	vllmVersion: "release" | "nightly" | "gpt-oss";
}): string {
	const args = [
		"bash",
		"/tmp/pod_setup.sh",
		"--models-path",
		params.modelsPath,
		"--hf-token",
		params.hfToken,
		"--vllm-api-key",
		params.vllmApiKey,
	];

	if (params.mount) {
		args.push("--mount", params.mount);
	}

	args.push("--vllm", params.vllmVersion);
	return args.map((arg) => shellQuote(arg)).join(" ");
}

/**
 * Switch active pod
 */
export const switchActivePod = (name: string) => {
	try {
		assertValidPodName(name);
	} catch (error) {
		console.error(chalk.red(error instanceof Error ? error.message : String(error)));
		process.exit(1);
	}

	const config = loadConfig();
	if (!config.pods[name]) {
		console.error(chalk.red(`Pod '${name}' not found`));
		console.log("\nAvailable pods:");
		for (const podName of Object.keys(config.pods)) {
			console.log(`  ${podName}`);
		}
		process.exit(1);
	}

	setActivePod(name);
	console.log(chalk.green(`✓ Switched active pod to '${name}'`));
};

/**
 * Remove a pod from config
 */
export const removePodCommand = (name: string) => {
	try {
		assertValidPodName(name);
	} catch (error) {
		console.error(chalk.red(error instanceof Error ? error.message : String(error)));
		process.exit(1);
	}

	const config = loadConfig();
	if (!config.pods[name]) {
		console.error(chalk.red(`Pod '${name}' not found`));
		process.exit(1);
	}

	removePod(name);
	console.log(chalk.green(`✓ Removed pod '${name}' from configuration`));
	console.log(chalk.yellow("Note: This only removes the local configuration. The remote pod is not affected."));
};
