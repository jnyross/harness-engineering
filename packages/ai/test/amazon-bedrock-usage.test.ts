import { describe, expect, it } from "vitest";
import { extractBedrockUsageMetadata } from "../src/providers/amazon-bedrock.js";

describe("extractBedrockUsageMetadata", () => {
	it("normalizes numeric usage metadata fields", () => {
		expect(
			extractBedrockUsageMetadata({
				inputTokens: 8,
				outputTokens: 3,
				cacheReadInputTokens: 2,
				cacheWriteInputTokens: 1,
				totalTokens: 14,
			}),
		).toEqual({
			input: 8,
			output: 3,
			cacheRead: 2,
			cacheWrite: 1,
			totalTokens: 14,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("normalizes numeric-string usage metadata fields", () => {
		expect(
			extractBedrockUsageMetadata({
				inputTokens: "8",
				outputTokens: "3",
				cacheReadInputTokens: "2",
				cacheWriteInputTokens: "1",
				totalTokens: "14",
			}),
		).toEqual({
			input: 8,
			output: 3,
			cacheRead: 2,
			cacheWrite: 1,
			totalTokens: 14,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("computes fallback totals when totalTokens is omitted", () => {
		expect(
			extractBedrockUsageMetadata({
				inputTokens: 2,
				outputTokens: 4,
				cacheReadInputTokens: 3,
				cacheWriteInputTokens: 1,
			}),
		).toEqual({
			input: 2,
			output: 4,
			cacheRead: 3,
			cacheWrite: 1,
			totalTokens: 10,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("ignores malformed and negative usage values", () => {
		expect(
			extractBedrockUsageMetadata({
				inputTokens: "4.8",
				outputTokens: -3,
				cacheReadInputTokens: "bad",
				cacheWriteInputTokens: "-2",
				totalTokens: "invalid",
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
			extractBedrockUsageMetadata({
				inputTokens: "0x10",
				outputTokens: "1e2",
				cacheReadInputTokens: "4.5",
				cacheWriteInputTokens: "0x1",
				totalTokens: "1e3",
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
			extractBedrockUsageMetadata({
				inputTokens: 8.8,
				outputTokens: 3.4,
				cacheReadInputTokens: 2.2,
				cacheWriteInputTokens: 1.1,
				totalTokens: 14.7,
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
			extractBedrockUsageMetadata({
				inputTokens: "9007199254740993",
				outputTokens: 9007199254740992,
				cacheReadInputTokens: "9007199254740993",
				cacheWriteInputTokens: "9007199254740993",
				totalTokens: "9007199254740993",
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

	it("ignores whitespace-padded numeric-string usage values", () => {
		expect(
			extractBedrockUsageMetadata({
				inputTokens: " 8 ",
				outputTokens: " 3 ",
				cacheReadInputTokens: " 2 ",
				cacheWriteInputTokens: " 1 ",
				totalTokens: " 14 ",
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

	it("returns undefined for invalid payloads", () => {
		expect(extractBedrockUsageMetadata(null)).toBeUndefined();
		expect(extractBedrockUsageMetadata("invalid")).toBeUndefined();
	});
});
