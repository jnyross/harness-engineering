export function parsePositiveIntegerOption(options: {
	value: string | undefined;
	fallback: number;
	optionName: string;
}): number {
	const rawValue = options.value;
	if (rawValue === undefined) {
		return options.fallback;
	}
	const trimmed = rawValue.trim();
	if (trimmed.length === 0) {
		return options.fallback;
	}
	if (trimmed !== rawValue) {
		throw new Error(`Invalid ${options.optionName} value '${options.value}'. Use a positive integer.`);
	}

	if (!/^\d+$/.test(rawValue)) {
		throw new Error(`Invalid ${options.optionName} value '${options.value}'. Use a positive integer.`);
	}

	const parsed = Number.parseInt(rawValue, 10);
	if (!Number.isSafeInteger(parsed) || parsed < 1) {
		throw new Error(`Invalid ${options.optionName} value '${options.value}'. Use a positive integer.`);
	}

	return parsed;
}
