import { type SpawnOptions, spawn } from "child_process";

export interface SSHResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

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
			resolveOnce({
				stdout,
				stderr,
				exitCode: code ?? (signal ? 1 : 0),
			});
		});

		proc.on("error", (err) => {
			resolveOnce({
				stdout,
				stderr: err.message,
				exitCode: 1,
			});
		});
	});
};

/**
 * Execute an SSH command with streaming output to console
 */
export const sshExecStream = async (
	sshCmd: string,
	command: string,
	options?: { silent?: boolean; forceTTY?: boolean; keepAlive?: boolean },
): Promise<number> => {
	return new Promise((resolve) => {
		let settled = false;
		const resolveOnce = (exitCode: number) => {
			if (settled) {
				return;
			}
			settled = true;
			resolve(exitCode);
		};

		let sshBinary: string;
		let sshArgs: string[];
		try {
			const parsed = parseSshCommand(sshCmd);
			sshBinary = parsed.sshBinary;
			sshArgs = [...parsed.sshArgs];
		} catch {
			resolve(1);
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
			resolveOnce(code ?? (signal ? 1 : 0));
		});

		proc.on("error", () => {
			resolveOnce(1);
		});
	});
};

/**
 * Copy a file to remote via SCP
 */
export const scpFile = async (sshCmd: string, localPath: string, remotePath: string): Promise<boolean> => {
	let host = "";
	let port = "22";
	let sshArgs: string[];
	try {
		const parsed = parseSshCommand(sshCmd);
		sshArgs = parsed.sshArgs;
	} catch {
		return false;
	}

	for (let i = 0; i < sshArgs.length; i++) {
		const arg = sshArgs[i];
		if (arg.startsWith("-p") && arg.length > 2 && !arg.startsWith("--")) {
			port = arg.slice(2);
			continue;
		}
		if (arg === "-p" && i + 1 < sshArgs.length) {
			port = sshArgs[i + 1];
			i++;
			continue;
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
		host = arg;
		break;
	}

	if (!host) {
		console.error("Could not parse host from SSH command");
		return false;
	}

	// Build SCP command
	const scpArgs = ["-P", port, localPath, `${host}:${remotePath}`];

	return new Promise((resolve) => {
		let settled = false;
		const resolveOnce = (result: boolean) => {
			if (settled) {
				return;
			}
			settled = true;
			resolve(result);
		};

		const proc = spawn("scp", scpArgs, { stdio: "inherit" });

		proc.on("close", (code, signal) => {
			resolveOnce(code === 0 && !signal);
		});

		proc.on("error", () => {
			resolveOnce(false);
		});
	});
};
