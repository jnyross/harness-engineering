const PI_PODS_CLI_COMMAND_ENV = "PI_PODS_CLI_COMMAND";

export function setCliCommand(command: string): void {
	process.env[PI_PODS_CLI_COMMAND_ENV] = command;
}

export function getCliCommand(): string {
	return process.env[PI_PODS_CLI_COMMAND_ENV] || "pi";
}
