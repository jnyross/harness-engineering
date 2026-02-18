import { parse as partialParse } from "partial-json";

function normalizeParsedJsonValue<T>(value: unknown): T {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as T;
	}
	return {} as T;
}

/**
 * Attempts to parse potentially incomplete JSON during streaming.
 * Always returns a valid object, even if the JSON is incomplete.
 *
 * @param partialJson The partial JSON string from streaming
 * @returns Parsed object or empty object if parsing fails
 */
// biome-ignore lint/suspicious/noExplicitAny: migration
export function parseStreamingJson<T = any>(partialJson: string | undefined): T {
	if (!partialJson || partialJson.trim() === "") {
		return {} as T;
	}

	// Try standard parsing first (fastest for complete JSON)
	try {
		return normalizeParsedJsonValue<T>(JSON.parse(partialJson));
	} catch {
		// Try partial-json for incomplete JSON
		try {
			const result = partialParse(partialJson);
			return normalizeParsedJsonValue<T>(result);
		} catch {
			// If all parsing fails, return empty object
			return {} as T;
		}
	}
}
