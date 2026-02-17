import { describe, expect, it } from "vitest";
import { extractGoogleUsageMetadata } from "../src/providers/google-shared.js";

describe("extractGoogleUsageMetadata", () => {
	it("normalizes numeric usage metadata fields", () => {
		expect(
			extractGoogleUsageMetadata({
				promptTokenCount: 10,
				candidatesTokenCount: 4,
				thoughtsTokenCount: 3,
				cachedContentTokenCount: 2,
				totalTokenCount: 19,
			}),
		).toEqual({
			input: 10,
			output: 7,
			cacheRead: 2,
			cacheWrite: 0,
			totalTokens: 19,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("parses numeric-string usage metadata fields", () => {
		expect(
			extractGoogleUsageMetadata({
				promptTokenCount: "10",
				candidatesTokenCount: "4",
				thoughtsTokenCount: "3",
				cachedContentTokenCount: "2",
				totalTokenCount: "19",
			}),
		).toEqual({
			input: 10,
			output: 7,
			cacheRead: 2,
			cacheWrite: 0,
			totalTokens: 19,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("computes total tokens when provider omits totalTokenCount", () => {
		expect(
			extractGoogleUsageMetadata({
				promptTokenCount: 3,
				candidatesTokenCount: 2,
				thoughtsTokenCount: 1,
				cachedContentTokenCount: 4,
			}),
		).toEqual({
			input: 3,
			output: 3,
			cacheRead: 4,
			cacheWrite: 0,
			totalTokens: 10,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("returns undefined for non-object usage payloads", () => {
		expect(extractGoogleUsageMetadata(null)).toBeUndefined();
		expect(extractGoogleUsageMetadata("invalid")).toBeUndefined();
	});
});
