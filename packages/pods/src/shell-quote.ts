const SHELL_ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function shellQuote(value: string): string {
	return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function joinShellArgs(args: string[]): string {
	return args.map((arg) => shellQuote(arg)).join(" ");
}

export function shellExport(name: string, value: string): string {
	if (!SHELL_ENV_NAME_PATTERN.test(name)) {
		throw new Error(`Invalid shell environment variable name: ${name}`);
	}
	return `export ${name}=${shellQuote(value)}`;
}
