const CONTEXT_SIZE_ALIASES = new Set(["4k", "8k", "16k", "32k", "64k", "128k"]);

export function normalizeMemoryOption(memory: string): string {
	const trimmed = memory.trim();
	const numericPart = trimmed.endsWith("%") ? trimmed.slice(0, -1).trim() : trimmed;
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

	const numeric = Number.parseInt(trimmed, 10);
	if (!Number.isFinite(numeric) || numeric <= 0) {
		throw new Error("Invalid --context value. Use 4k/8k/16k/32k/64k/128k or a positive token count.");
	}

	return String(numeric);
}
