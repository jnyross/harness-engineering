export function normalizeChildExitCode(code: number | null, signal: NodeJS.Signals | null): number {
	if (signal) {
		return 1;
	}
	return code ?? 1;
}

export function getSignalTerminationMessage(processLabel: string, signal: NodeJS.Signals | null): string | undefined {
	if (!signal) {
		return undefined;
	}
	return `${processLabel} terminated by signal ${signal}`;
}
