export function readRequiredOptionValue(commandArgs: string[], optionIndex: number, optionName: string): string {
	const value = commandArgs[optionIndex + 1];
	if (!value || value.startsWith("--")) {
		throw new Error(`Option ${optionName} requires a value.`);
	}
	return value;
}
