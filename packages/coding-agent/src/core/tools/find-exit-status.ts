import type { SpawnSyncReturns } from "node:child_process";

export function getFindExitError(result: SpawnSyncReturns<string>): string | undefined {
	const spawnError = result.error;
	if (spawnError) {
		return `Failed to run fd: ${spawnError.message}`;
	}

	const closeSignal = result.signal;
	if (closeSignal) {
		return `fd exited due to signal ${closeSignal}`;
	}

	if (result.status === null) {
		return "fd exited with unknown status";
	}

	if (result.status !== 0) {
		const output = result.stdout?.trim() ?? "";
		if (!output) {
			return result.stderr?.trim() || `fd exited with code ${result.status}`;
		}
	}

	return undefined;
}
