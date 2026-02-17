import { spawn } from "child_process";

const MAX_TIMEOUT_MS = 2_147_483_647;

export type SandboxConfig = { type: "host" } | { type: "docker"; container: string };

const DOCKER_CONTAINER_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

function buildSandboxCommandText(command: string, args: string[]): string {
	return `${command} ${args.join(" ")}`.trim();
}

export function normalizeSandboxExitCode(code: number | null, signal: NodeJS.Signals | null): number {
	if (signal) {
		return 1;
	}
	return code ?? 1;
}

export function getSandboxCommandExitError(options: {
	command: string;
	args: string[];
	code: number | null;
	signal: NodeJS.Signals | null;
	stderr: string;
}): string | undefined {
	if (options.code === 0 && !options.signal) {
		return undefined;
	}

	const commandText = buildSandboxCommandText(options.command, options.args);
	if (options.signal) {
		return options.stderr || `Command ${commandText} failed (terminated by signal ${options.signal})`;
	}
	if (options.code === null) {
		return options.stderr || `Command ${commandText} failed (unknown exit status)`;
	}
	return options.stderr || `Command ${commandText} failed (exit code ${options.code})`;
}

export function getSandboxCommandStartError(options: { command: string; args: string[]; error: Error }): string {
	const commandText = buildSandboxCommandText(options.command, options.args);
	return `Failed to start command '${commandText}': ${options.error.message}`;
}

export function parseSandboxArg(value: string): SandboxConfig {
	if (value === "host") {
		return { type: "host" };
	}
	if (value.startsWith("docker:")) {
		const container = value.slice("docker:".length);
		if (!container) {
			console.error("Error: docker sandbox requires container name (e.g., docker:mom-sandbox)");
			process.exit(1);
		}
		if (!DOCKER_CONTAINER_NAME_PATTERN.test(container)) {
			console.error(
				"Error: invalid docker container name. Use letters, numbers, dots, underscores, and dashes only.",
			);
			process.exit(1);
		}
		return { type: "docker", container };
	}
	console.error(`Error: Invalid sandbox type '${value}'. Use 'host' or 'docker:<container-name>'`);
	process.exit(1);
}

export async function validateSandbox(config: SandboxConfig): Promise<void> {
	if (config.type === "host") {
		return;
	}

	// Check if Docker is available
	try {
		await execSimple("docker", ["--version"]);
	} catch {
		console.error("Error: Docker is not installed or not in PATH");
		process.exit(1);
	}

	// Check if container exists and is running
	try {
		const result = await execSimple("docker", ["inspect", "-f", "{{.State.Running}}", config.container]);
		if (result.trim() !== "true") {
			console.error(`Error: Container '${config.container}' is not running.`);
			console.error(`Start it with: docker start ${config.container}`);
			process.exit(1);
		}
	} catch {
		console.error(`Error: Container '${config.container}' does not exist.`);
		console.error("Create it with: ./docker.sh create <data-dir>");
		process.exit(1);
	}

	console.log(`  Docker container '${config.container}' is running.`);
}

function execSimple(cmd: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		let settled = false;

		const rejectOnce = (error: Error) => {
			if (settled) {
				return;
			}
			settled = true;
			reject(error);
		};

		const resolveOnce = (value: string) => {
			if (settled) {
				return;
			}
			settled = true;
			resolve(value);
		};

		child.stdout?.on("data", (d) => {
			stdout += d;
		});
		child.stderr?.on("data", (d) => {
			stderr += d;
		});
		child.on("error", (error) => {
			const startupError = error instanceof Error ? error : new Error(String(error));
			rejectOnce(
				new Error(
					getSandboxCommandStartError({
						command: cmd,
						args,
						error: startupError,
					}),
				),
			);
		});
		child.on("close", (code, signal) => {
			const exitError = getSandboxCommandExitError({
				command: cmd,
				args,
				code,
				signal,
				stderr,
			});
			if (!exitError) {
				resolveOnce(stdout);
				return;
			}
			rejectOnce(new Error(exitError));
		});
	});
}

/**
 * Create an executor that runs commands either on host or in Docker container
 */
export function createExecutor(config: SandboxConfig): Executor {
	if (config.type === "host") {
		return new HostExecutor();
	}
	return new DockerExecutor(config.container);
}

export interface Executor {
	/**
	 * Execute a bash command
	 */
	exec(command: string, options?: ExecOptions): Promise<ExecResult>;

	/**
	 * Get the workspace path prefix for this executor
	 * Host: returns the actual path
	 * Docker: returns /workspace
	 */
	getWorkspacePath(hostPath: string): string;
}

export interface ExecOptions {
	timeout?: number;
	signal?: AbortSignal;
}

export interface ExecResult {
	stdout: string;
	stderr: string;
	code: number;
}

function parseExecTimeoutSeconds(timeout: number | undefined): number | undefined {
	if (timeout === undefined) {
		return undefined;
	}
	const timeoutMs = timeout * 1000;
	if (!Number.isFinite(timeout) || timeout <= 0 || !Number.isFinite(timeoutMs) || timeoutMs > MAX_TIMEOUT_MS) {
		return undefined;
	}
	return timeout;
}

export function buildDockerExecArgs(container: string, command: string): string[] {
	return ["exec", container, "sh", "-c", command];
}

function execWithSpawn(command: string, args: string[], options?: ExecOptions): Promise<ExecResult> {
	if (options?.signal?.aborted) {
		return Promise.reject(new Error("Command aborted"));
	}

	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			detached: true,
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		let timedOut = false;
		let settled = false;
		const normalizedTimeoutSeconds = parseExecTimeoutSeconds(options?.timeout);

		const timeoutHandle =
			normalizedTimeoutSeconds !== undefined
				? setTimeout(() => {
						timedOut = true;
						killProcessTree(child.pid!);
					}, normalizedTimeoutSeconds * 1000)
				: undefined;

		const rejectOnce = (error: Error) => {
			if (settled) {
				return;
			}
			settled = true;
			if (timeoutHandle) clearTimeout(timeoutHandle);
			if (options?.signal) {
				options.signal.removeEventListener("abort", onAbort);
			}
			reject(error);
		};

		const resolveOnce = (result: ExecResult) => {
			if (settled) {
				return;
			}
			settled = true;
			if (timeoutHandle) clearTimeout(timeoutHandle);
			if (options?.signal) {
				options.signal.removeEventListener("abort", onAbort);
			}
			resolve(result);
		};

		const onAbort = () => {
			if (child.pid) killProcessTree(child.pid);
		};

		if (options?.signal) {
			if (options.signal.aborted) {
				onAbort();
			} else {
				options.signal.addEventListener("abort", onAbort, { once: true });
			}
		}

		child.stdout?.on("data", (data) => {
			stdout += data.toString();
			if (stdout.length > 10 * 1024 * 1024) {
				stdout = stdout.slice(0, 10 * 1024 * 1024);
			}
		});

		child.stderr?.on("data", (data) => {
			stderr += data.toString();
			if (stderr.length > 10 * 1024 * 1024) {
				stderr = stderr.slice(0, 10 * 1024 * 1024);
			}
		});

		child.on("error", (error) => {
			const startupError = error instanceof Error ? error : new Error(String(error));
			rejectOnce(
				new Error(
					getSandboxCommandStartError({
						command,
						args,
						error: startupError,
					}),
				),
			);
		});

		child.on("close", (code, signal) => {
			if (options?.signal?.aborted) {
				rejectOnce(new Error(`${stdout}\n${stderr}\nCommand aborted`.trim()));
				return;
			}

			if (timedOut) {
				rejectOnce(
					new Error(`${stdout}\n${stderr}\nCommand timed out after ${normalizedTimeoutSeconds} seconds`.trim()),
				);
				return;
			}

			const normalizedCode = normalizeSandboxExitCode(code, signal);
			const stderrWithFallback =
				stderr ||
				(normalizedCode !== 0
					? getSandboxCommandExitError({
							command,
							args,
							code,
							signal,
							stderr,
						}) || stderr
					: stderr);
			resolveOnce({ stdout, stderr: stderrWithFallback, code: normalizedCode });
		});
	});
}

class HostExecutor implements Executor {
	async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
		const shell = process.platform === "win32" ? "cmd" : "sh";
		const shellArgs = process.platform === "win32" ? ["/c"] : ["-c"];
		return execWithSpawn(shell, [...shellArgs, command], options);
	}

	getWorkspacePath(hostPath: string): string {
		return hostPath;
	}
}

class DockerExecutor implements Executor {
	constructor(private container: string) {}

	async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
		return execWithSpawn("docker", buildDockerExecArgs(this.container, command), options);
	}

	getWorkspacePath(_hostPath: string): string {
		// Docker container sees /workspace
		return "/workspace";
	}
}

function killProcessTree(pid: number): void {
	if (process.platform === "win32") {
		try {
			const taskkill = spawn("taskkill", ["/F", "/T", "/PID", String(pid)], {
				stdio: "ignore",
				detached: true,
			});
			taskkill.on("error", () => {
				// Ignore async spawn failures in best-effort cleanup path.
			});
			taskkill.unref();
		} catch {
			// Ignore errors
		}
	} else {
		try {
			process.kill(-pid, "SIGKILL");
		} catch {
			try {
				process.kill(pid, "SIGKILL");
			} catch {
				// Process already dead
			}
		}
	}
}
