export function buildRpcClientCommandText(command: string, args: string[]): string {
	return [command, ...args].join(" ").trim();
}

export function getRpcClientStartError(options: {
	command: string;
	args: string[];
	error: Error;
	stderr: string;
}): string {
	const invokedCommand = buildRpcClientCommandText(options.command, options.args);
	const stderr = options.stderr.trim() || "(none)";
	return `Failed to start agent process '${invokedCommand}': ${options.error.message}. Stderr: ${stderr}`;
}

export function getRpcClientStartupExitError(options: {
	command: string;
	args: string[];
	code: number | null;
	signal: NodeJS.Signals | null;
	stderr: string;
}): string {
	const invokedCommand = buildRpcClientCommandText(options.command, options.args);
	const exitReason = options.signal ? `signal ${options.signal}` : `code ${options.code ?? "unknown"}`;
	const stderr = options.stderr.trim() || "(none)";
	return `Agent process '${invokedCommand}' exited before initialization with ${exitReason}. Stderr: ${stderr}`;
}
