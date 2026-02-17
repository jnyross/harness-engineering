import type { SpawnSyncReturns } from "node:child_process";

export function getPackageManagerStartError(options: { invokedCommand: string; error: Error }): string {
	return `Failed to start command ${options.invokedCommand}: ${options.error.message}`;
}

export function getPackageManagerSyncCommandError(
	result: SpawnSyncReturns<string>,
	options: { invokedCommand: string; timeoutMs?: number },
): string | undefined {
	if (result.error) {
		const error = result.error as NodeJS.ErrnoException;
		if (error.code === "ETIMEDOUT" && options.timeoutMs) {
			return `Command ${options.invokedCommand} timed out after ${options.timeoutMs}ms`;
		}
		return getPackageManagerStartError({ invokedCommand: options.invokedCommand, error: result.error });
	}

	if (result.signal) {
		return `Command ${options.invokedCommand} exited due to signal ${result.signal}`;
	}

	if (result.status === null) {
		return `Command ${options.invokedCommand} exited with unknown status`;
	}

	if (result.status !== 0) {
		return `Failed to run command ${options.invokedCommand}: ${result.stderr || result.stdout || `exited with code ${result.status}`}`;
	}

	return undefined;
}

export function getPackageManagerAsyncCloseError(options: {
	invokedCommand: string;
	code: number | null;
	signal: NodeJS.Signals | null;
}): string | undefined {
	if (options.signal) {
		return `Command ${options.invokedCommand} exited due to signal ${options.signal}`;
	}

	if (options.code === null) {
		return `Command ${options.invokedCommand} exited with unknown status`;
	}

	if (options.code !== 0) {
		return `Command ${options.invokedCommand} failed with code ${options.code}`;
	}

	return undefined;
}
