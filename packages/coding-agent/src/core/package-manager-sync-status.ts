import type { SpawnSyncReturns } from "node:child_process";

export function getPackageManagerSyncCommandError(
	result: SpawnSyncReturns<string>,
	options: { invokedCommand: string; timeoutMs?: number },
): string | undefined {
	if (result.error) {
		const error = result.error as NodeJS.ErrnoException;
		if (error.code === "ETIMEDOUT" && options.timeoutMs) {
			return `${options.invokedCommand} timed out after ${options.timeoutMs}ms`;
		}
		return `Failed to start ${options.invokedCommand}: ${result.error.message}`;
	}

	if (result.signal) {
		return `${options.invokedCommand} exited due to signal ${result.signal}`;
	}

	if (result.status === null) {
		return `${options.invokedCommand} exited with unknown status`;
	}

	if (result.status !== 0) {
		return `Failed to run ${options.invokedCommand}: ${result.stderr || result.stdout || `exited with code ${result.status}`}`;
	}

	return undefined;
}
