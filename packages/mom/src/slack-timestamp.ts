export function parseSlackTimestampToMilliseconds(timestamp: string): number | undefined {
	const trimmed = timestamp.trim();
	if (/^\d+\.\d+$/.test(trimmed)) {
		const seconds = Number.parseFloat(trimmed);
		if (Number.isFinite(seconds) && seconds >= 0) {
			return Math.floor(seconds * 1000);
		}
		return undefined;
	}

	if (/^\d+$/.test(trimmed)) {
		const numericValue = Number.parseInt(trimmed, 10);
		if (Number.isSafeInteger(numericValue) && numericValue >= 0) {
			// Slack timestamps are usually decimal seconds (e.g. "1700000000.123456").
			// Handle integer-second variants by treating <=10-digit values as seconds.
			if (trimmed.length <= 10) {
				return numericValue * 1000;
			}
			return numericValue;
		}
	}

	return undefined;
}

export function getLatestSlackTimestamp(timestamps: Iterable<string>): string | undefined {
	let latestTimestamp: string | undefined;
	let latestTimestampMs: number | undefined;

	for (const timestamp of timestamps) {
		const timestampMs = parseSlackTimestampToMilliseconds(timestamp);
		if (timestampMs === undefined) {
			continue;
		}
		if (latestTimestampMs === undefined || timestampMs > latestTimestampMs) {
			latestTimestamp = timestamp;
			latestTimestampMs = timestampMs;
		}
	}

	return latestTimestamp;
}
