export function normalizeRpcExtensionExitCode(code: number | null, signal: NodeJS.Signals | null): number {
	if (signal) {
		return 1;
	}
	return code ?? 1;
}

export function getRpcExtensionExitReason(code: number | null, signal: NodeJS.Signals | null): string {
	if (signal) {
		return `signal ${signal}`;
	}
	if (code === null) {
		return "unknown status";
	}
	return `code ${code}`;
}

export function getRpcExtensionStartError(options: { command: string; args: string[]; error: Error }): string {
	const invokedCommand = [options.command, ...options.args].join(" ").trim();
	return `Failed to start agent process '${invokedCommand}': ${options.error.message}`;
}
