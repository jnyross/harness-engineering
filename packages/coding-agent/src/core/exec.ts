/**
 * Shared command execution utilities for extensions and custom tools.
 */

import { spawn } from "node:child_process";
import { normalizeProcessExitCode } from "./process-exit-status.js";

const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Options for executing shell commands.
 */
export interface ExecOptions {
	/** AbortSignal to cancel the command */
	signal?: AbortSignal;
	/** Timeout in milliseconds */
	timeout?: number;
	/** Grace period before escalating SIGTERM to SIGKILL (milliseconds). */
	forceKillDelayMs?: number;
	/** Working directory */
	cwd?: string;
}

/**
 * Result of executing a shell command.
 */
export interface ExecResult {
	stdout: string;
	stderr: string;
	code: number;
	killed: boolean;
}

function parseTimeoutMs(timeout: number | undefined): number | undefined {
	if (timeout === undefined) {
		return undefined;
	}
	if (!Number.isFinite(timeout) || timeout <= 0 || timeout > MAX_TIMEOUT_MS) {
		return undefined;
	}
	return timeout;
}

export function getExecCommandCloseError(options: {
	command: string;
	args: string[];
	code: number | null;
	signal: NodeJS.Signals | null;
}): string | undefined {
	if (options.code === 0 && !options.signal) {
		return undefined;
	}

	const invokedCommand = [options.command, ...options.args].join(" ");
	if (options.signal) {
		return `Command '${invokedCommand}' terminated by signal ${options.signal}`;
	}
	if (options.code === null) {
		return `Command '${invokedCommand}' exited with unknown status`;
	}
	return `Command '${invokedCommand}' exited with code ${options.code}`;
}

/**
 * Execute a shell command and return stdout/stderr/code.
 * Supports timeout and abort signal.
 */
export async function execCommand(
	command: string,
	args: string[],
	cwd: string,
	options?: ExecOptions,
): Promise<ExecResult> {
	const normalizedTimeout = parseTimeoutMs(options?.timeout);
	if (options?.signal?.aborted) {
		return { stdout: "", stderr: "Command aborted", code: 1, killed: true };
	}

	return new Promise((resolve) => {
		const invokedCommand = [command, ...args].join(" ");
		const proc = spawn(command, args, {
			cwd,
			shell: false,
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		let killed = false;
		let settled = false;
		let timeoutId: NodeJS.Timeout | undefined;
		let forceKillId: NodeJS.Timeout | undefined;
		const forceKillDelayMs = options?.forceKillDelayMs ?? 5000;

		const cleanup = () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			if (forceKillId) {
				clearTimeout(forceKillId);
			}
			if (options?.signal) {
				options.signal.removeEventListener("abort", killProcess);
			}
		};

		const resolveOnce = (result: ExecResult) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			resolve(result);
		};

		const killProcess = () => {
			if (!killed) {
				killed = true;
				proc.kill("SIGTERM");
				// Force kill after grace period if SIGTERM doesn't work
				forceKillId = setTimeout(() => {
					if (proc.exitCode === null && proc.signalCode === null) {
						proc.kill("SIGKILL");
					}
				}, forceKillDelayMs);
			}
		};

		// Handle abort signal
		if (options?.signal) {
			if (options.signal.aborted) {
				killProcess();
			} else {
				options.signal.addEventListener("abort", killProcess, { once: true });
			}
		}

		// Handle timeout
		if (normalizedTimeout !== undefined) {
			timeoutId = setTimeout(() => {
				killProcess();
			}, normalizedTimeout);
		}

		proc.stdout?.on("data", (data) => {
			stdout += data.toString();
		});

		proc.stderr?.on("data", (data) => {
			stderr += data.toString();
		});

		proc.on("close", (code, signal) => {
			const normalizedCode = killed ? 1 : normalizeProcessExitCode(code, signal);
			const closeError =
				killed || normalizedCode === 0
					? undefined
					: getExecCommandCloseError({
							command,
							args,
							code,
							signal,
						});
			if (closeError && !stderr.trim()) {
				stderr = closeError;
			}
			resolveOnce({ stdout, stderr, code: normalizedCode, killed });
		});

		proc.on("error", (err) => {
			stderr = `Failed to start command '${invokedCommand}': ${err.message}`;
			resolveOnce({ stdout, stderr, code: 1, killed });
		});
	});
}
