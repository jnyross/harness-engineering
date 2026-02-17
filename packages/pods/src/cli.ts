#!/usr/bin/env node
import chalk from "chalk";
import { spawn } from "child_process";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { normalizeChildExitCode } from "./child-exit-status.js";
import { extractPodOverride, resolveAppCommand } from "./cli-args.js";
import { setCliCommand } from "./cli-command.js";
import { listModels, showKnownModels, startModel, stopAllModels, stopModel, viewLogs } from "./commands/models.js";
import { listPods, removePodCommand, setupPod, switchActivePod } from "./commands/pods.js";
import { promptModel } from "./commands/prompt.js";
import { getActivePod, loadConfig } from "./config.js";
import { normalizeContextOption, normalizeMemoryOption } from "./model-options.js";
import { extractModelsPathFromMountCommand } from "./mount-command.js";
import { assertValidPodName } from "./pod-name.js";
import { getSshStreamExitError, parseSshCommand, sshExecStreamDetailed } from "./ssh.js";
import type { Pod } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
const MODEL_COMMANDS_WITH_POD = new Set(["start", "stop", "list", "logs", "agent"]);
const DIRECT_COMMANDS = new Set(["shell", "ssh", "start", "stop", "list", "logs", "agent"]);
const APP_COMMAND = resolveAppCommand(process.argv[1]);
setCliCommand(APP_COMMAND);

function printHelp() {
	console.log(`${APP_COMMAND} v${packageJson.version} - Manage vLLM deployments on GPU pods

Pod Management:
  ${APP_COMMAND} pods setup <name> "<ssh>" --mount "<mount>"    Setup pod with mount command
    Options:
      --vllm release    Install latest vLLM release >=0.10.0 (default)
      --vllm nightly    Install vLLM nightly build (latest features)
      --vllm gpt-oss    Install vLLM 0.10.1+gptoss with PyTorch nightly (GPT-OSS only)
  ${APP_COMMAND} pods                                           List all pods (* = active)
  ${APP_COMMAND} pods active <name>                             Switch active pod
  ${APP_COMMAND} pods remove <name>                             Remove pod from local config
  ${APP_COMMAND} shell [<name>]                                 Open shell on pod (active or specified)
  ${APP_COMMAND} ssh [<name>] "<command>"                       Run SSH command on pod

Model Management:
  ${APP_COMMAND} start <model> --name <name> [options]          Start a model
    --memory <percent>   GPU memory allocation (30%, 50%, 90%)
    --context <size>     Context window (4k, 8k, 16k, 32k, 64k, 128k)
    --gpus <count>       Number of GPUs to use (predefined models only)
    --vllm <args...>     Pass remaining args to vLLM (ignores other options)
  ${APP_COMMAND} stop [<name>]                                  Stop model (or all if no name)
  ${APP_COMMAND} list                                           List running models
  ${APP_COMMAND} logs <name>                                    Stream model logs
  ${APP_COMMAND} agent <name> ["<message>"...] [options]        Chat with model using agent & tools
  ${APP_COMMAND} agent <name> [options]                         Interactive chat mode
    --continue, -c       Continue previous session
    --json              Output as JSONL
    (Most pi-agent options are supported; --provider/--model are managed by pi pods)

  All model commands support --pod <name> to override the active pod.

Environment:
  HF_TOKEN         HuggingFace token for model downloads
  PI_API_KEY     API key for vLLM endpoints
  PI_CONFIG_DIR    Config directory (default: ~/.pi)`);
}

function validatePodNameOrExit(name: string): void {
	try {
		assertValidPodName(name);
	} catch (error) {
		console.error(chalk.red(error instanceof Error ? error.message : String(error)));
		process.exit(1);
	}
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
	printHelp();
	process.exit(0);
}

if (args[0] === "--version" || args[0] === "-v") {
	console.log(packageJson.version);
	process.exit(0);
}

const command = args[0];
const subcommand = args[1];

// Main command handler
try {
	// Handle "pi pods" commands
	if (command === "pods") {
		if (!subcommand) {
			// pi pods - list all pods
			listPods();
		} else if (subcommand === "setup") {
			// pi pods setup <name> "<ssh>" [--mount "<mount>"] [--models-path <path>] [--vllm release|nightly|gpt-oss]
			const name = args[2];
			const sshCmd = args[3];

			if (!name || !sshCmd) {
				console.error(
					`Usage: ${APP_COMMAND} pods setup <name> "<ssh>" [--mount "<mount>"] [--models-path <path>] [--vllm release|nightly|gpt-oss]`,
				);
				process.exit(1);
			}
			validatePodNameOrExit(name);

			// Parse options
			const options: { mount?: string; modelsPath?: string; vllm?: "release" | "nightly" | "gpt-oss" } = {};
			for (let i = 4; i < args.length; i++) {
				if (args[i] === "--mount" && i + 1 < args.length) {
					options.mount = args[i + 1];
					i++;
				} else if (args[i] === "--models-path" && i + 1 < args.length) {
					options.modelsPath = args[i + 1];
					i++;
				} else if (args[i] === "--vllm" && i + 1 < args.length) {
					const vllmType = args[i + 1];
					if (vllmType === "release" || vllmType === "nightly" || vllmType === "gpt-oss") {
						options.vllm = vllmType;
					} else {
						console.error(chalk.red(`Invalid vLLM type: ${vllmType}`));
						console.error("Valid options: release, nightly, gpt-oss");
						process.exit(1);
					}
					i++;
				}
			}

			// If --mount provided but no --models-path, try to extract path from mount command
			if (options.mount && !options.modelsPath) {
				options.modelsPath = extractModelsPathFromMountCommand(options.mount);
			}

			await setupPod(name, sshCmd, options);
		} else if (subcommand === "active") {
			// pi pods active <name>
			const name = args[2];
			if (!name) {
				console.error(`Usage: ${APP_COMMAND} pods active <name>`);
				process.exit(1);
			}
			validatePodNameOrExit(name);
			switchActivePod(name);
		} else if (subcommand === "remove") {
			// pi pods remove <name>
			const name = args[2];
			if (!name) {
				console.error(`Usage: ${APP_COMMAND} pods remove <name>`);
				process.exit(1);
			}
			validatePodNameOrExit(name);
			removePodCommand(name);
		} else {
			console.error(`Unknown pods subcommand: ${subcommand}`);
			process.exit(1);
		}
	} else {
		// Parse --pod override only for known direct commands.
		// Unknown commands should surface "Unknown command" errors, not pod-flag parsing errors.
		const podParseResult = DIRECT_COMMANDS.has(command)
			? extractPodOverride(args, MODEL_COMMANDS_WITH_POD.has(command))
			: { podOverride: undefined, argsWithoutPod: args };
		const podOverride = podParseResult.podOverride;
		if (podOverride) {
			validatePodNameOrExit(podOverride);
		}
		const commandArgs = podParseResult.argsWithoutPod;

		// Handle SSH/shell commands and model commands
		switch (command) {
			case "shell": {
				// pi shell [<name>] - open interactive shell
				const podName = commandArgs[1];
				let podInfo: { name: string; pod: Pod } | null = null;

				if (podName) {
					validatePodNameOrExit(podName);
					const config = loadConfig();
					const pod = config.pods[podName];
					if (pod) {
						podInfo = { name: podName, pod };
					}
				} else {
					podInfo = getActivePod();
				}

				if (!podInfo) {
					if (podName) {
						console.error(chalk.red(`Pod '${podName}' not found`));
					} else {
						console.error(chalk.red(`No active pod. Use '${APP_COMMAND} pods active <name>' to set one.`));
					}
					process.exit(1);
				}

				console.log(chalk.green(`Connecting to pod '${podInfo.name}'...`));

				// Execute SSH in interactive mode
				try {
					const { sshBinary, sshArgs } = parseSshCommand(podInfo.pod.ssh);
					const invokedCommand = [sshBinary, ...sshArgs].join(" ");
					const sshProcess = spawn(sshBinary, sshArgs, {
						stdio: "inherit",
						env: process.env,
					});
					let settled = false;
					const exitOnce = (exitCode: number, message?: string) => {
						if (settled) {
							return;
						}
						settled = true;
						if (message) {
							console.error(chalk.red(message));
						}
						process.exit(exitCode);
					};

					sshProcess.on("error", (error) => {
						exitOnce(1, `Failed to start SSH process '${invokedCommand}': ${error.message}`);
					});

					sshProcess.on("exit", (code, signal) => {
						exitOnce(normalizeChildExitCode(code, signal), getSshStreamExitError(code, signal));
					});
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					console.error(chalk.red(message));
					process.exit(1);
				}
				break;
			}
			case "ssh": {
				// pi ssh [<name>] "<command>" - run command via SSH
				let podName: string | undefined;
				let sshCommand: string;

				if (commandArgs.length === 2) {
					// pi ssh "<command>" - use active pod
					sshCommand = commandArgs[1];
				} else if (commandArgs.length === 3) {
					// pi ssh <name> "<command>"
					podName = commandArgs[1];
					validatePodNameOrExit(podName);
					sshCommand = commandArgs[2];
				} else {
					console.error(`Usage: ${APP_COMMAND} ssh [<name>] "<command>"`);
					process.exit(1);
				}

				let podInfo: { name: string; pod: Pod } | null = null;

				if (podName) {
					const config = loadConfig();
					const pod = config.pods[podName];
					if (pod) {
						podInfo = { name: podName, pod };
					}
				} else {
					podInfo = getActivePod();
				}

				if (!podInfo) {
					if (podName) {
						console.error(chalk.red(`Pod '${podName}' not found`));
					} else {
						console.error(chalk.red(`No active pod. Use '${APP_COMMAND} pods active <name>' to set one.`));
					}
					process.exit(1);
				}

				console.log(chalk.gray(`Running on pod '${podInfo.name}': ${sshCommand}`));

				// Execute command and stream output
				const sshResult = await sshExecStreamDetailed(podInfo.pod.ssh, sshCommand);
				if (sshResult.error) {
					console.error(chalk.red(sshResult.error));
				}
				process.exit(sshResult.exitCode);
				break;
			}
			case "start": {
				// pi start <model> --name <name> [options]
				const modelId = commandArgs[1];
				if (!modelId) {
					// Show available models
					await showKnownModels();
					process.exit(0);
				}

				// Parse options
				let name: string | undefined;
				let memory: string | undefined;
				let context: string | undefined;
				let gpus: number | undefined;
				const vllmArgs: string[] = [];
				let inVllmArgs = false;

				for (let i = 2; i < commandArgs.length; i++) {
					if (inVllmArgs) {
						vllmArgs.push(commandArgs[i]);
					} else if (commandArgs[i] === "--name" && i + 1 < commandArgs.length) {
						name = commandArgs[i + 1];
						i++;
					} else if (commandArgs[i] === "--memory" && i + 1 < commandArgs.length) {
						try {
							memory = normalizeMemoryOption(commandArgs[i + 1]);
						} catch (error) {
							console.error(chalk.red(error instanceof Error ? error.message : String(error)));
							process.exit(1);
						}
						i++;
					} else if (commandArgs[i] === "--context" && i + 1 < commandArgs.length) {
						try {
							context = normalizeContextOption(commandArgs[i + 1]);
						} catch (error) {
							console.error(chalk.red(error instanceof Error ? error.message : String(error)));
							process.exit(1);
						}
						i++;
					} else if (commandArgs[i] === "--gpus" && i + 1 < commandArgs.length) {
						gpus = parseInt(commandArgs[i + 1], 10);
						if (Number.isNaN(gpus) || gpus < 1) {
							console.error(chalk.red("--gpus must be a positive number"));
							process.exit(1);
						}
						i++;
					} else if (commandArgs[i] === "--vllm") {
						inVllmArgs = true;
					}
				}

				if (!name) {
					console.error("--name is required");
					process.exit(1);
				}

				// Warn if --vllm is used with other parameters
				if (vllmArgs.length > 0 && (memory || context || gpus)) {
					console.log(
						chalk.yellow("⚠ Warning: --memory, --context, and --gpus are ignored when --vllm is specified"),
					);
					console.log(chalk.yellow("  Using only custom vLLM arguments"));
					console.log("");
				}

				await startModel(modelId, name, {
					pod: podOverride,
					memory,
					context,
					gpus,
					vllmArgs: vllmArgs.length > 0 ? vllmArgs : undefined,
				});
				break;
			}
			case "stop": {
				// pi stop [name] - stop specific model or all models
				const name = commandArgs[1];
				if (!name) {
					// Stop all models on the active pod
					await stopAllModels({ pod: podOverride });
				} else {
					await stopModel(name, { pod: podOverride });
				}
				break;
			}
			case "list":
				// pi list
				await listModels({ pod: podOverride });
				break;
			case "logs": {
				// pi logs <name>
				const name = commandArgs[1];
				if (!name) {
					console.error(`Usage: ${APP_COMMAND} logs <name>`);
					process.exit(1);
				}
				await viewLogs(name, { pod: podOverride });
				break;
			}
			case "agent": {
				// pi agent <name> [messages...] [options]
				const name = commandArgs[1];
				if (!name) {
					console.error(`Usage: ${APP_COMMAND} agent <name> [messages...] [options]`);
					process.exit(1);
				}

				const apiKey = process.env.PI_API_KEY;

				// Pass all args after the model name
				const agentArgs = commandArgs.slice(2);

				// If no messages provided, it's interactive mode
				try {
					await promptModel(name, agentArgs, {
						pod: podOverride,
						apiKey,
					});
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					console.error(chalk.red(message));
					process.exit(1);
				}
				break;
			}
			default:
				console.error(`Unknown command: ${command}`);
				printHelp();
				process.exit(1);
		}
	}
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(chalk.red(message));
	process.exit(1);
}
