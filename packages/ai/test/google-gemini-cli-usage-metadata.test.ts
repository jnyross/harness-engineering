import { describe, expect, it } from "vitest";
import { extractCloudCodeAssistUsageMetadata } from "../src/providers/google-gemini-cli.js";

describe("extractCloudCodeAssistUsageMetadata", () => {
	it("normalizes numeric usage metadata fields", () => {
		expect(
			extractCloudCodeAssistUsageMetadata({
				promptTokenCount: 12,
				candidatesTokenCount: 5,
				thoughtsTokenCount: 2,
				cachedContentTokenCount: 4,
				totalTokenCount: 19,
			}),
		).toEqual({
			input: 8,
			output: 7,
			cacheRead: 4,
			cacheWrite: 0,
			totalTokens: 19,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("normalizes numeric-string usage metadata fields", () => {
		expect(
			extractCloudCodeAssistUsageMetadata({
				promptTokenCount: "12",
				candidatesTokenCount: "5",
				thoughtsTokenCount: "2",
				cachedContentTokenCount: "4",
				totalTokenCount: "19",
			}),
		).toEqual({
			input: 8,
			output: 7,
			cacheRead: 4,
			cacheWrite: 0,
			totalTokens: 19,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("computes fallback total tokens when totalTokenCount is omitted", () => {
		expect(
			extractCloudCodeAssistUsageMetadata({
				promptTokenCount: 7,
				candidatesTokenCount: 3,
				thoughtsTokenCount: 1,
				cachedContentTokenCount: 2,
			}),
		).toEqual({
			input: 5,
			output: 4,
			cacheRead: 2,
			cacheWrite: 0,
			totalTokens: 11,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("returns undefined for invalid payloads", () => {
		expect(extractCloudCodeAssistUsageMetadata(null)).toBeUndefined();
		expect(extractCloudCodeAssistUsageMetadata("invalid")).toBeUndefined();
	});

	it("ignores malformed and negative usage values", () => {
		expect(
			extractCloudCodeAssistUsageMetadata({
				promptTokenCount: "-5",
				candidatesTokenCount: "3.8",
				thoughtsTokenCount: "oops",
				cachedContentTokenCount: -2,
				totalTokenCount: "-1",
			}),
		).toEqual({
			input: 0,
			output: 3,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 3,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});
});
