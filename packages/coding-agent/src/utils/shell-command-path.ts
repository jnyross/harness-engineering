import type { SpawnSyncReturns } from "node:child_process";

export function getCommandPathFromLookup(
	result: SpawnSyncReturns<string>,
	options?: { validatePath?: (path: string) => boolean },
): string | undefined {
	if (result.error || result.signal || result.status === null || result.status !== 0 || !result.stdout) {
		return undefined;
	}

	const candidates = result.stdout
		.trim()
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	if (candidates.length === 0) {
		return undefined;
	}

	const validatePath = options?.validatePath;
	if (validatePath) {
		return candidates.find((candidate) => validatePath(candidate));
	}

	return candidates[0];
}
