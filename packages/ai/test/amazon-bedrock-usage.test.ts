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

	it("returns undefined for invalid payloads", () => {
		expect(extractBedrockUsageMetadata(null)).toBeUndefined();
		expect(extractBedrockUsageMetadata("invalid")).toBeUndefined();
	});
});
