import type { SpawnSyncReturns } from "node:child_process";

export function getToolExtractionError(
	result: SpawnSyncReturns<Buffer>,
	options: { archiveName: string },
): string | undefined {
	if (result.error) {
		const error = result.error as NodeJS.ErrnoException;
		if (error.code === "ETIMEDOUT") {
			return `Failed to extract ${options.archiveName}: extraction timed out`;
		}
		return `Failed to extract ${options.archiveName}: ${error.message}`;
	}

	if (result.signal) {
		return `Failed to extract ${options.archiveName}: terminated by signal ${result.signal}`;
	}

	if (result.status === null) {
		return `Failed to extract ${options.archiveName}: exited with unknown status`;
	}

	if (result.status !== 0) {
		const stderr = result.stderr?.toString().trim();
		const stdout = result.stdout?.toString().trim();
		return `Failed to extract ${options.archiveName}: ${stderr || stdout || `exited with code ${result.status}`}`;
	}

	return undefined;
}
