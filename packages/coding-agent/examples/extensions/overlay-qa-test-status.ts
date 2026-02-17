export function getOverlayQATestStartError(options: { command: string; args: string[]; error: Error }): string {
	const invokedCommand = [options.command, ...options.args].join(" ").trim();
	return `Failed to start stream process '${invokedCommand}': ${options.error.message}`;
}
