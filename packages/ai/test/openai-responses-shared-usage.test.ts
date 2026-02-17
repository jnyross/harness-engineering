import { describe, expect, it } from "vitest";
import { extractOpenAIResponsesUsage } from "../src/providers/openai-responses-shared.js";

describe("extractOpenAIResponsesUsage", () => {
	it("normalizes standard OpenAI usage fields", () => {
		expect(
			extractOpenAIResponsesUsage({
				input_tokens: 100,
				output_tokens: 40,
				total_tokens: 140,
				input_tokens_details: { cached_tokens: 25 },
			}),
		).toEqual({
			input: 75,
			output: 40,
			cacheRead: 25,
			cacheWrite: 0,
			totalTokens: 140,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("falls back to prompt/completion usage fields", () => {
		expect(
			extractOpenAIResponsesUsage({
				prompt_tokens: 64,
				completion_tokens: 21,
				total_tokens: 85,
				prompt_tokens_details: { cached_tokens: 10 },
			}),
		).toEqual({
			input: 54,
			output: 21,
			cacheRead: 10,
			cacheWrite: 0,
			totalTokens: 85,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("computes total tokens when provider omits total_tokens", () => {
		expect(
			extractOpenAIResponsesUsage({
				prompt_tokens: 50,
				completion_tokens: 15,
				prompt_tokens_details: { cached_tokens: 5 },
			}),
		).toEqual({
			input: 45,
			output: 15,
			cacheRead: 5,
			cacheWrite: 0,
			totalTokens: 65,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("parses numeric string token fields from compatible backends", () => {
		expect(
			extractOpenAIResponsesUsage({
				prompt_tokens: "42",
				completion_tokens: "8",
				prompt_tokens_details: { cached_tokens: "7" },
				total_tokens: "50",
			}),
		).toEqual({
			input: 35,
			output: 8,
			cacheRead: 7,
			cacheWrite: 0,
			totalTokens: 50,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("returns undefined for non-object payloads", () => {
		expect(extractOpenAIResponsesUsage(null)).toBeUndefined();
		expect(extractOpenAIResponsesUsage("not-usage")).toBeUndefined();
	});
});
