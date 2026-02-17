import type { SpawnSyncReturns } from "node:child_process";

export function getTrashCommandErrorHint(result: SpawnSyncReturns<string>): string | undefined {
	const parts: string[] = [];

	if (result.error) {
		parts.push(result.error.message);
	}
	if (result.signal) {
		parts.push(`terminated by signal ${result.signal}`);
	}
	if (result.status === null && !result.signal && !result.error) {
		parts.push("exited with unknown status");
	}
	if (result.status !== null && result.status !== 0) {
		parts.push(`exited with code ${result.status}`);
	}
	const stderr = result.stderr?.trim();
	if (stderr) {
		parts.push(stderr.split("\n")[0] ?? stderr);
	}

	if (parts.length === 0) {
		return undefined;
	}

	return `trash: ${parts.join(" · ").slice(0, 200)}`;
}
