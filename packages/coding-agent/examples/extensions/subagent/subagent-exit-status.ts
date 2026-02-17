export function getSubagentProcessExitStatus(
	code: number | null,
	signal: NodeJS.Signals | null,
): {
	exitCode: number;
	failureReason?: string;
} {
	if (signal) {
		return {
			exitCode: 1,
			failureReason: `Subagent process terminated by signal ${signal}`,
		};
	}

	if (code === null) {
		return {
			exitCode: 1,
			failureReason: "Subagent process exited with unknown status",
		};
	}

	if (code !== 0) {
		return {
			exitCode: code,
			failureReason: `Subagent process exited with code ${code}`,
		};
	}

	return { exitCode: 0 };
}

export function getSubagentStartError(options: { command: string; args: string[]; error: Error }): string {
	const invokedCommand = [options.command, ...options.args].join(" ").trim();
	return `Failed to start subagent command '${invokedCommand}': ${options.error.message}`;
}
