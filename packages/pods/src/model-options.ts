const CONTEXT_SIZE_ALIASES = new Set(["4k", "8k", "16k", "32k", "64k", "128k"]);

function parsePositiveSafeIntegerOption(value: string, optionName: "--context" | "--gpus"): number {
	const trimmed = value.trim();
	if (trimmed !== value) {
		throw new Error(`Invalid ${optionName} value. Use a positive integer.`);
	}
	if (!/^\d+$/.test(trimmed)) {
		throw new Error(`Invalid ${optionName} value. Use a positive integer.`);
	}

	const numeric = Number.parseInt(trimmed, 10);
	if (!Number.isSafeInteger(numeric) || numeric < 1) {
		throw new Error(`Invalid ${optionName} value. Use a positive integer.`);
	}

	return numeric;
}

export function normalizeMemoryOption(memory: string): string {
	const value = parseMemoryPercentage(memory);
	if (value === undefined) {
		throw new Error('Invalid --memory value. Use a percentage between 0 and 100 (for example: "50%" or "75").');
	}
	return `${String(value)}%`;
}

export function parseMemoryPercentage(memory: string): number | undefined {
	const trimmed = memory.trim();
	const numericPart = trimmed.endsWith("%") ? trimmed.slice(0, -1).trim() : trimmed;
	if (!/^\d+(?:\.\d+)?$/.test(numericPart)) {
		return undefined;
	}
	const [wholePart, fractionalPart = ""] = numericPart.split(".");
	if (!wholePart) {
		return undefined;
	}
	const whole = BigInt(wholePart);
	if (whole > 100n) {
		return undefined;
	}
	if (whole === 100n && /[1-9]/.test(fractionalPart)) {
		return undefined;
	}
	const value = Number(numericPart);

	if (!Number.isFinite(value) || value <= 0 || value > 100) {
		return undefined;
	}

	return value;
}

export function normalizeContextOption(context: string): string {
	const trimmed = context.trim();
	if (trimmed !== context) {
		throw new Error("Invalid --context value. Use 4k/8k/16k/32k/64k/128k or a positive token count.");
	}
	const normalized = trimmed.toLowerCase();

	if (CONTEXT_SIZE_ALIASES.has(normalized)) {
		return normalized;
	}

	try {
		return String(parsePositiveSafeIntegerOption(trimmed, "--context"));
	} catch {
		throw new Error("Invalid --context value. Use 4k/8k/16k/32k/64k/128k or a positive token count.");
	}
}

export function normalizeGpuCountOption(gpuCount: string): number {
	return parsePositiveSafeIntegerOption(gpuCount, "--gpus");
}
