export function normalizeSshExampleExitCode(code: number | null, signal: NodeJS.Signals | null): number {
	if (signal) {
		return 1;
	}
	return code ?? 1;
}

export function getSshExampleFailureReason(code: number | null, signal: NodeJS.Signals | null): string {
	if (signal) {
		return `signal ${signal}`;
	}
	if (code === null) {
		return "unknown status";
	}
	return `code ${code}`;
}

export function getSshExampleStartError(options: { invokedCommand: string; error: Error }): string {
	return `Failed to start SSH command '${options.invokedCommand}': ${options.error.message}`;
}
