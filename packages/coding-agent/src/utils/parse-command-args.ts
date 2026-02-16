/**
 * Parse command arguments respecting quoted strings and shell-style escapes.
 */
export function parseCommandArgs(argsString: string): string[] {
	const args: string[] = [];
	let current = "";
	let inQuote: "'" | '"' | null = null;
	let escaping = false;
	let tokenStarted = false;

	for (let i = 0; i < argsString.length; i++) {
		const char = argsString[i];

		if (inQuote) {
			if (inQuote === '"' && escaping) {
				current += char;
				escaping = false;
				continue;
			}

			if (inQuote === '"' && char === "\\") {
				const nextChar = argsString[i + 1];
				if (nextChar !== undefined) {
					escaping = true;
					continue;
				}
			}

			if (char === inQuote) {
				inQuote = null;
			} else {
				current += char;
			}
		} else if (char === '"' || char === "'") {
			tokenStarted = true;
			inQuote = char;
		} else if (char === " " || char === "\t") {
			if (tokenStarted) {
				args.push(current);
				current = "";
				tokenStarted = false;
			}
		} else if (char === "\\") {
			const nextChar = argsString[i + 1];
			if (nextChar !== undefined) {
				current += nextChar;
				tokenStarted = true;
				i++;
			} else {
				current += "\\";
				tokenStarted = true;
			}
		} else {
			current += char;
			tokenStarted = true;
		}
	}

	if (escaping) {
		current += "\\";
	}

	if (tokenStarted) {
		args.push(current);
	}

	return args;
}
