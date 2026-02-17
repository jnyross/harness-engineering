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
			// Handle integer-second variants when the value is below 1e12 (~2001 in ms terms).
			if (numericValue < 1_000_000_000_000) {
				return numericValue * 1000;
			}
			return numericValue;
		}
	}

	return undefined;
}

export function isValidSlackTimestamp(timestamp: string | undefined): timestamp is string {
	return typeof timestamp === "string" && parseSlackTimestampToMilliseconds(timestamp) !== undefined;
}

function parseSlackTimestampSortValue(timestamp: string): bigint | undefined {
	const trimmed = timestamp.trim();
	const decimalMatch = trimmed.match(/^(\d+)\.(\d+)$/);
	if (decimalMatch) {
		const seconds = BigInt(decimalMatch[1]);
		const microseconds = BigInt(decimalMatch[2].slice(0, 6).padEnd(6, "0"));
		return seconds * 1_000_000n + microseconds;
	}

	if (/^\d+$/.test(trimmed)) {
		const numericValue = BigInt(trimmed);
		if (numericValue < 1_000_000_000_000n) {
			// Seconds -> microseconds
			return numericValue * 1_000_000n;
		}
		// Milliseconds -> microseconds
		return numericValue * 1_000n;
	}

	return undefined;
}

export function isSlackTimestampOlder(timestamp: string, baseline: string): boolean | undefined {
	const timestampValue = parseSlackTimestampSortValue(timestamp);
	const baselineValue = parseSlackTimestampSortValue(baseline);
	if (timestampValue === undefined || baselineValue === undefined) {
		return undefined;
	}
	return timestampValue < baselineValue;
}

export function getLatestSlackTimestamp(timestamps: Iterable<string>): string | undefined {
	let latestTimestamp: string | undefined;
	let latestTimestampSortValue: bigint | undefined;

	for (const timestamp of timestamps) {
		const timestampSortValue = parseSlackTimestampSortValue(timestamp);
		if (timestampSortValue === undefined) {
			continue;
		}
		if (latestTimestampSortValue === undefined || timestampSortValue > latestTimestampSortValue) {
			latestTimestamp = timestamp;
			latestTimestampSortValue = timestampSortValue;
		}
	}

	return latestTimestamp;
}
