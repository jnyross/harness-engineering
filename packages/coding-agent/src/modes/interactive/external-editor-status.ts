import type { SpawnSyncReturns } from "node:child_process";

function trimSpawnOutput(output: Buffer | string | null | undefined): string | undefined {
	if (output === undefined || output === null) {
		return undefined;
	}
	const text = Buffer.isBuffer(output) ? output.toString("utf-8") : output;
	const trimmed = text.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

export function getExternalEditorError(
	result: SpawnSyncReturns<Buffer | string>,
	options?: { invokedCommand?: string },
): string | undefined {
	const processLabel = options?.invokedCommand
		? `External editor command '${options.invokedCommand}'`
		: "External editor";

	if (result.error) {
		return `Failed to start ${processLabel.toLowerCase()}: ${result.error.message}`;
	}
	if (result.signal) {
		return `${processLabel} terminated by signal ${result.signal}`;
	}
	if (result.status === null) {
		return `${processLabel} exited with unknown status`;
	}
	if (result.status !== 0) {
		const details = trimSpawnOutput(result.stderr) ?? trimSpawnOutput(result.stdout);
		return details
			? `${processLabel} exited with code ${result.status}: ${details}`
			: `${processLabel} exited with code ${result.status}`;
	}
	return undefined;
}
