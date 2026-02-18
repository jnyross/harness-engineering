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

	it("ignores malformed and negative usage values", () => {
		expect(
			extractGoogleUsageMetadata({
				promptTokenCount: -4,
				candidatesTokenCount: "2.9",
				thoughtsTokenCount: "nope",
				cachedContentTokenCount: "-1",
				totalTokenCount: "bad",
			}),
		).toEqual({
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("ignores non-decimal numeric string formats", () => {
		expect(
			extractGoogleUsageMetadata({
				promptTokenCount: "0x10",
				candidatesTokenCount: "1e2",
				thoughtsTokenCount: "2.2",
				cachedContentTokenCount: "0x2",
				totalTokenCount: "1e3",
			}),
		).toEqual({
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("ignores fractional numeric usage values", () => {
		expect(
			extractGoogleUsageMetadata({
				promptTokenCount: 10.4,
				candidatesTokenCount: 4.6,
				thoughtsTokenCount: 3.2,
				cachedContentTokenCount: 2.1,
				totalTokenCount: 19.9,
			}),
		).toEqual({
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("ignores unsafe integer usage values", () => {
		expect(
			extractGoogleUsageMetadata({
				promptTokenCount: "9007199254740993",
				candidatesTokenCount: 9007199254740992,
				thoughtsTokenCount: "9007199254740993",
				cachedContentTokenCount: "9007199254740993",
				totalTokenCount: "9007199254740993",
			}),
		).toEqual({
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("returns undefined for non-object usage payloads", () => {
		expect(extractGoogleUsageMetadata(null)).toBeUndefined();
		expect(extractGoogleUsageMetadata("invalid")).toBeUndefined();
	});
});
