import { parseShellCommand } from "./ssh.js";

export function extractModelsPathFromMountCommand(command: string): string | undefined {
	let parts: string[];
	try {
		parts = parseShellCommand(command);
	} catch {
		return undefined;
	}

	if (parts.length === 0) {
		return undefined;
	}

	const lastPart = parts[parts.length - 1];
	return lastPart.startsWith("/") ? lastPart : undefined;
}
