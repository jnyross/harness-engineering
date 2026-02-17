const CONTEXT_SIZE_ALIASES = new Set(["4k", "8k", "16k", "32k", "64k", "128k"]);

function parsePositiveSafeIntegerOption(value: string, optionName: "--context" | "--gpus"): number {
	const trimmed = value.trim();
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
	const trimmed = memory.trim();
	const numericPart = trimmed.endsWith("%") ? trimmed.slice(0, -1).trim() : trimmed;
	if (!/^\d+(?:\.\d+)?$/.test(numericPart)) {
		throw new Error('Invalid --memory value. Use a percentage between 0 and 100 (for example: "50%" or "75").');
	}
	const value = Number(numericPart);

	if (!Number.isFinite(value) || value <= 0 || value > 100) {
		throw new Error('Invalid --memory value. Use a percentage between 0 and 100 (for example: "50%" or "75").');
	}

	const normalized = Number.isInteger(value) ? String(value) : String(value);
	return `${normalized}%`;
}

export function normalizeContextOption(context: string): string {
	const trimmed = context.trim();
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
