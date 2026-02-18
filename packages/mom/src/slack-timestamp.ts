const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const INTEGER_SECOND_THRESHOLD = 1_000_000_000_000n;

function parseDecimalSlackTimestampMilliseconds(timestamp: string): number | undefined {
	const decimalMatch = timestamp.match(/^(\d+)\.(\d+)$/);
	if (!decimalMatch) {
		return undefined;
	}

	const seconds = BigInt(decimalMatch[1]);
	const fractionalMilliseconds = BigInt(decimalMatch[2].slice(0, 3).padEnd(3, "0"));
	const milliseconds = seconds * 1000n + fractionalMilliseconds;
	if (milliseconds > MAX_SAFE_INTEGER_BIGINT) {
		return undefined;
	}
	return Number(milliseconds);
}

function parseIntegerSlackTimestampMilliseconds(timestamp: string): number | undefined {
	if (!/^\d+$/.test(timestamp)) {
		return undefined;
	}

	const numericValue = BigInt(timestamp);
	const milliseconds =
		numericValue < INTEGER_SECOND_THRESHOLD
			? numericValue * 1000n // Integer seconds
			: numericValue; // Integer milliseconds
	if (milliseconds > MAX_SAFE_INTEGER_BIGINT) {
		return undefined;
	}
	return Number(milliseconds);
}

export function parseSlackTimestampToMilliseconds(timestamp: string): number | undefined {
	const trimmed = timestamp.trim();
	const decimalMilliseconds = parseDecimalSlackTimestampMilliseconds(trimmed);
	if (decimalMilliseconds !== undefined) {
		return decimalMilliseconds;
	}

	return parseIntegerSlackTimestampMilliseconds(trimmed);
}

export function isValidSlackTimestamp(timestamp: string | undefined): timestamp is string {
	return typeof timestamp === "string" && parseSlackTimestampToMilliseconds(timestamp) !== undefined;
}

function parseSlackTimestampSortValue(timestamp: unknown): bigint | undefined {
	if (typeof timestamp !== "string") {
		return undefined;
	}
	const trimmed = timestamp.trim();
	const decimalMatch = trimmed.match(/^(\d+)\.(\d+)$/);
	if (decimalMatch) {
		const seconds = BigInt(decimalMatch[1]);
		const microseconds = BigInt(decimalMatch[2].slice(0, 6).padEnd(6, "0"));
		return seconds * 1_000_000n + microseconds;
	}

	if (/^\d+$/.test(trimmed)) {
		const numericValue = BigInt(trimmed);
		if (numericValue < INTEGER_SECOND_THRESHOLD) {
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
