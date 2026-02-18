function parseNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

export function parsePackageVersion(content: string, fallback = "unknown"): string {
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		return fallback;
	}

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return fallback;
	}

	const version = parseNonEmptyString((parsed as { version?: unknown }).version);
	return version ?? fallback;
}
