export function shellQuote(value: string): string {
	return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function joinShellArgs(args: string[]): string {
	return args.map((arg) => shellQuote(arg)).join(" ");
}
