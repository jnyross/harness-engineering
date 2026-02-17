export function parseProviderSelection(choice: string, providerCount: number): number | undefined {
	const trimmed = choice.trim();
	if (!/^\d+$/.test(trimmed)) {
		return undefined;
	}

	const parsed = Number.parseInt(trimmed, 10);
	if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > providerCount) {
		return undefined;
	}

	return parsed - 1;
}
