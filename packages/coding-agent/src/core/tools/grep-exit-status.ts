export function getRipgrepExitError(options: {
	code: number | null;
	signal: NodeJS.Signals | null;
	stderr: string;
	killedDueToLimit: boolean;
}): string | undefined {
	if (options.killedDueToLimit) {
		return undefined;
	}

	const trimmedStderr = options.stderr.trim();
	if (options.signal) {
		return trimmedStderr || `ripgrep exited due to signal ${options.signal}`;
	}

	if (options.code === null) {
		return trimmedStderr || "ripgrep exited with unknown status";
	}

	if (options.code === 0 || options.code === 1) {
		return undefined;
	}

	return trimmedStderr || `ripgrep exited with code ${options.code}`;
}
