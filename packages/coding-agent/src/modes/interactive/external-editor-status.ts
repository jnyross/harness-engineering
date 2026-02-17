import type { SpawnSyncReturns } from "node:child_process";

export function getExternalEditorError(result: SpawnSyncReturns<Buffer | string>): string | undefined {
	if (result.error) {
		return `Failed to start external editor: ${result.error.message}`;
	}
	if (result.signal) {
		return `External editor terminated by signal ${result.signal}`;
	}
	if (result.status === null) {
		return "External editor exited with unknown status";
	}
	if (result.status !== 0) {
		return `External editor exited with code ${result.status}`;
	}
	return undefined;
}
