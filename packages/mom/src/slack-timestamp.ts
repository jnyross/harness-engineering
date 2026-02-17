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
		const milliseconds = Number.parseInt(trimmed, 10);
		if (Number.isFinite(milliseconds) && milliseconds >= 0) {
			return milliseconds;
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
