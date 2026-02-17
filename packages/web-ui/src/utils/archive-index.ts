export function parseArchiveEntryIndex(path: string, matcher: RegExp): number {
	const rawIndex = path.match(matcher)?.[1];
	if (!rawIndex || !/^\d+$/.test(rawIndex)) {
		return 0;
	}

	const parsed = Number.parseInt(rawIndex, 10);
	if (!Number.isSafeInteger(parsed) || parsed < 0) {
		return 0;
	}

	return parsed;
}
