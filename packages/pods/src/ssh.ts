import { type SpawnOptions, spawn } from "child_process";
import { getSignalTerminationMessage, normalizeChildExitCode } from "./child-exit-status.js";

export interface SSHResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

export interface ScpResult {
	ok: boolean;
	error?: string;
}

export interface SSHStreamResult {
	exitCode: number;
	error?: string;
}

const SCP_FLAGS_WITH_VALUE = new Set(["-c", "-D", "-F", "-i", "-J", "-l", "-o", "-S", "-X"]);
const SCP_FLAGS_NO_VALUE = new Set([
	"-3",
	"-4",
	"-6",
	"-A",
	"-B",
	"-C",
	"-O",
	"-p",
	"-q",
	"-R",
	"-r",
	"-s",
	"-T",
	"-v",
]);

const SSH_FLAGS_WITH_VALUE = new Set([
	"-b",
	"-c",
	"-D",
	"-E",
	"-F",
	"-I",
	"-i",
	"-J",
	"-L",
	"-l",
	"-m",
	"-o",
	"-p",
	"-Q",
	"-R",
	"-S",
	"-W",
]);

function isSshBinary(binary: string): boolean {
	return /(?:^|[\\/])ssh(?:\.exe)?$/i.test(binary);
}

function hasAttachedShortFlagValue(arg: string): boolean {
	if (!arg.startsWith("-") || arg.startsWith("--") || arg.length <= 2) {
		return false;
	}
	return SSH_FLAGS_WITH_VALUE.has(arg.slice(0, 2));
}

export function parseShellCommand(command: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let quote: "'" | '"' | null = null;
	let tokenStarted = false;

	for (let i = 0; i < command.length; i++) {
		const char = command[i];

		if (quote === "'") {
			if (char === "'") {
				quote = null;
			} else {
				current += char;
			}
			tokenStarted = true;
			continue;
		}

		if (quote === '"') {
			if (char === '"') {
				quote = null;
			} else if (char === "\\") {
				const nextChar = command[i + 1];
				if (nextChar === '"' || nextChar === "\\") {
					current += nextChar;
					i++;
				} else {
					current += "\\";
				}
			} else {
				current += char;
			}
			tokenStarted = true;
			continue;
		}

		if (char === "'" || char === '"') {
			quote = char;
			tokenStarted = true;
			continue;
		}

		if (char === "\\") {
			const nextChar = command[i + 1];
			if (
				nextChar === " " ||
				nextChar === "\t" ||
				nextChar === "\n" ||
				nextChar === '"' ||
				nextChar === "'" ||
				nextChar === "\\"
			) {
				current += nextChar;
				i++;
			} else {
				current += "\\";
			}
			tokenStarted = true;
			continue;
		}

		if (/\s/.test(char)) {
			if (tokenStarted) {
				tokens.push(current);
				current = "";
				tokenStarted = false;
			}
			continue;
		}

		current += char;
		tokenStarted = true;
	}

	if (quote) {
		throw new Error("Invalid SSH command: unmatched quote.");
	}

	if (tokenStarted) {
		tokens.push(current);
	}

	return tokens;
}

export function parseSshCommand(sshCmd: string): { sshBinary: string; sshArgs: string[] } {
	const sshParts = parseShellCommand(sshCmd);
	if (sshParts.length === 0) {
		throw new Error("Invalid SSH command: command is empty.");
	}
	const sshBinary = sshParts[0];
	if (!isSshBinary(sshBinary)) {
		throw new Error(`Invalid SSH command: expected ssh binary, got "${sshBinary}".`);
	}

	return {
		sshBinary,
		sshArgs: sshParts.slice(1),
	};
}

export function extractHostFromSshCommand(sshCmd: string): string | undefined {
	let sshArgs: string[];
	try {
		({ sshArgs } = parseSshCommand(sshCmd));
	} catch {
		return undefined;
	}
	for (let i = 0; i < sshArgs.length; i++) {
		const arg = sshArgs[i];
		if (arg === "--") {
			return sshArgs[i + 1]?.split("@").pop();
		}
		if (arg.startsWith("-")) {
			if (hasAttachedShortFlagValue(arg)) {
				continue;
			}
			if (SSH_FLAGS_WITH_VALUE.has(arg)) {
				i++;
			}
			continue;
		}
		return arg.split("@").pop();
	}
	return undefined;
}

/**
 * Execute an SSH command and return the result
 */
export const sshExec = async (
	sshCmd: string,
	command: string,
	options?: { keepAlive?: boolean },
): Promise<SSHResult> => {
	return new Promise((resolve) => {
		let settled = false;
		const resolveOnce = (result: SSHResult) => {
			if (settled) {
				return;
			}
			settled = true;
			resolve(result);
		};

		let sshBinary: string;
		let sshArgs: string[];
		try {
			const parsed = parseSshCommand(sshCmd);
			sshBinary = parsed.sshBinary;
			sshArgs = [...parsed.sshArgs];
		} catch (error) {
			resolve({
				stdout: "",
				stderr: error instanceof Error ? error.message : String(error),
				exitCode: 1,
			});
			return;
		}

		// Add SSH keepalive options for long-running commands
		if (options?.keepAlive) {
			// ServerAliveInterval=30 sends keepalive every 30 seconds
			// ServerAliveCountMax=120 allows up to 120 failures (60 minutes total)
			sshArgs = ["-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=120", ...sshArgs];
		}

		sshArgs.push(command);
		const invokedCommand = [sshBinary, ...sshArgs].join(" ");

		const proc = spawn(sshBinary, sshArgs, {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		proc.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		proc.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		proc.on("close", (code, signal) => {
			const exitCode = normalizeChildExitCode(code, signal);
			const stderrMessage =
				stderr ||
				(exitCode !== 0 ? getSshStreamExitError(code, signal) || `SSH process exited with code ${exitCode}` : "");
			resolveOnce({
				stdout,
				stderr: stderrMessage,
				exitCode,
			});
		});

		proc.on("error", (err) => {
			resolveOnce({
				stdout,
				stderr: `Failed to start SSH command '${invokedCommand}': ${err.message}`,
				exitCode: 1,
			});
		});
	});
};

/**
 * Execute an SSH command with streaming output to console
 */
export function getSshStreamExitError(code: number | null, signal: NodeJS.Signals | null): string | undefined {
	if (signal) {
		return getSignalTerminationMessage("SSH process", signal);
	}
	if (code === null) {
		return "SSH process exited with unknown status";
	}
	if (code !== 0) {
		return `SSH process exited with code ${code}`;
	}
	return undefined;
}

export const sshExecStreamDetailed = async (
	sshCmd: string,
	command: string,
	options?: { silent?: boolean; forceTTY?: boolean; keepAlive?: boolean },
): Promise<SSHStreamResult> => {
	return new Promise((resolve) => {
		let settled = false;
		const resolveOnce = (result: SSHStreamResult) => {
			if (settled) {
				return;
			}
			settled = true;
			resolve(result);
		};

		let sshBinary: string;
		let sshArgs: string[];
		try {
			const parsed = parseSshCommand(sshCmd);
			sshBinary = parsed.sshBinary;
			sshArgs = [...parsed.sshArgs];
		} catch (error) {
			resolveOnce({
				exitCode: 1,
				error: error instanceof Error ? error.message : String(error),
			});
			return;
		}

		// Add -t flag if requested and not already present
		if (options?.forceTTY && !sshArgs.includes("-t")) {
			sshArgs = ["-t", ...sshArgs];
		}

		// Add SSH keepalive options for long-running commands
		if (options?.keepAlive) {
			// ServerAliveInterval=30 sends keepalive every 30 seconds
			// ServerAliveCountMax=120 allows up to 120 failures (60 minutes total)
			sshArgs = ["-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=120", ...sshArgs];
		}

		sshArgs.push(command);

		const spawnOptions: SpawnOptions = options?.silent
			? { stdio: ["ignore", "ignore", "ignore"] }
			: { stdio: "inherit" };

		const proc = spawn(sshBinary, sshArgs, spawnOptions);

		proc.on("close", (code, signal) => {
			resolveOnce({
				exitCode: normalizeChildExitCode(code, signal),
				error: getSshStreamExitError(code, signal),
			});
		});

		proc.on("error", (error) => {
			resolveOnce({
				exitCode: 1,
				error: `Failed to start SSH process: ${error.message}`,
			});
		});
	});
};

export const sshExecStream = async (
	sshCmd: string,
	command: string,
	options?: { silent?: boolean; forceTTY?: boolean; keepAlive?: boolean },
): Promise<number> => {
	const result = await sshExecStreamDetailed(sshCmd, command, options);
	return result.exitCode;
};

/**
 * Copy a file to remote via SCP
 */
export function getScpExitError(code: number | null, signal: NodeJS.Signals | null): string | undefined {
	if (signal) {
		return `scp process terminated by signal ${signal}`;
	}
	if (code === null) {
		return "scp process exited with unknown status";
	}
	if (code !== 0) {
		return `scp process exited with code ${code}`;
	}
	return undefined;
}

function buildScpOptions(sshArgs: string[]): { options: string[]; host: string } | { error: string } {
	const options: string[] = [];
	let host = "";

	for (let i = 0; i < sshArgs.length; i++) {
		const arg = sshArgs[i];

		if (arg === "--") {
			host = sshArgs[i + 1] ?? "";
			break;
		}

		if (arg.startsWith("-p") && arg.length > 2 && !arg.startsWith("--")) {
			options.push("-P", arg.slice(2));
			continue;
		}

		if (arg === "-p") {
			const port = sshArgs[i + 1];
			if (!port) {
				return { error: "Invalid SSH command: missing value for -p option." };
			}
			options.push("-P", port);
			i++;
			continue;
		}

		if (arg.startsWith("-")) {
			const attachedValueFlag = hasAttachedShortFlagValue(arg);
			if (attachedValueFlag) {
				const flag = arg.slice(0, 2);
				const value = arg.slice(2);
				if (!SCP_FLAGS_WITH_VALUE.has(flag)) {
					return { error: `Unsupported SSH option for SCP: ${flag}` };
				}
				options.push(flag, value);
				continue;
			}

			if (SCP_FLAGS_WITH_VALUE.has(arg)) {
				const value = sshArgs[i + 1];
				if (!value) {
					return { error: `Invalid SSH command: missing value for ${arg} option.` };
				}
				options.push(arg, value);
				i++;
				continue;
			}

			if (SCP_FLAGS_NO_VALUE.has(arg)) {
				options.push(arg);
				continue;
			}

			if (SSH_FLAGS_WITH_VALUE.has(arg)) {
				return { error: `Unsupported SSH option for SCP: ${arg}` };
			}

			// Unknown short options are forwarded for compatibility.
			options.push(arg);
			continue;
		}

		host = arg;
		break;
	}

	if (!host) {
		return { error: "Could not parse host from SSH command" };
	}

	return { options, host };
}

export const scpFile = async (sshCmd: string, localPath: string, remotePath: string): Promise<ScpResult> => {
	let sshArgs: string[];
	try {
		const parsed = parseSshCommand(sshCmd);
		sshArgs = parsed.sshArgs;
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}

	const scpOptionsResult = buildScpOptions(sshArgs);
	if ("error" in scpOptionsResult) {
		return {
			ok: false,
			error: scpOptionsResult.error,
		};
	}

	// Build SCP command
	const scpArgs = [...scpOptionsResult.options, localPath, `${scpOptionsResult.host}:${remotePath}`];

	return new Promise((resolve) => {
		let settled = false;
		const resolveOnce = (result: ScpResult) => {
			if (settled) {
				return;
			}
			settled = true;
			resolve(result);
		};

		const proc = spawn("scp", scpArgs, { stdio: "inherit" });

		proc.on("close", (code, signal) => {
			const exitError = getScpExitError(code, signal);
			resolveOnce(exitError ? { ok: false, error: exitError } : { ok: true });
		});

		proc.on("error", (error) => {
			resolveOnce({
				ok: false,
				error: `Failed to start scp command: ${error.message}`,
			});
		});
	});
};
