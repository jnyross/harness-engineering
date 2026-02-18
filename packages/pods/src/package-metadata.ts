const SEMVER_VERSION_PATTERN =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parsePackageVersionValue(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	if (trimmed.length === 0 || trimmed !== value) {
		return undefined;
	}
	return SEMVER_VERSION_PATTERN.test(value) ? value : undefined;
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

	const version = parsePackageVersionValue((parsed as { version?: unknown }).version);
	return version ?? fallback;
}
