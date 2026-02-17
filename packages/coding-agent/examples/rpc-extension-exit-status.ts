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
