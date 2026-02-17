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
		? `external editor command '${options.invokedCommand}'`
		: "external editor";

	if (result.error) {
		return `Failed to start ${processLabel}: ${result.error.message}`;
	}
	if (result.signal) {
		return `${capitalizeExternalEditorLabel(processLabel)} terminated by signal ${result.signal}`;
	}
	if (result.status === null) {
		return `${capitalizeExternalEditorLabel(processLabel)} exited with unknown status`;
	}
	if (result.status !== 0) {
		const details = trimSpawnOutput(result.stderr) ?? trimSpawnOutput(result.stdout);
		return details
			? `${capitalizeExternalEditorLabel(processLabel)} exited with code ${result.status}: ${details}`
			: `${capitalizeExternalEditorLabel(processLabel)} exited with code ${result.status}`;
	}
	return undefined;
}

function capitalizeExternalEditorLabel(label: string): string {
	return label.slice(0, 1).toUpperCase() + label.slice(1);
}
