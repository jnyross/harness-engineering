import { describe, expect, it } from "vitest";
import { getModel } from "../src/models.js";
import { convertResponsesMessages, extractOpenAIResponsesUsage } from "../src/providers/openai-responses-shared.js";
import type { AssistantMessage, Context } from "../src/types.js";

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

	it("ignores malformed and negative token fields", () => {
		expect(
			extractOpenAIResponsesUsage({
				prompt_tokens: "12.4",
				completion_tokens: -2,
				prompt_tokens_details: { cached_tokens: "3.7" },
				total_tokens: "broken",
			}),
		).toEqual({
			input: 9,
			output: 0,
			cacheRead: 3,
			cacheWrite: 0,
			totalTokens: 12,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
	});

	it("ignores non-decimal numeric string token fields", () => {
		expect(
			extractOpenAIResponsesUsage({
				prompt_tokens: "0x10",
				completion_tokens: "1e2",
				prompt_tokens_details: { cached_tokens: "0x3" },
				total_tokens: "1e3",
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

	it("ignores unsafe integer token fields", () => {
		expect(
			extractOpenAIResponsesUsage({
				prompt_tokens: "9007199254740993",
				completion_tokens: 9007199254740992,
				prompt_tokens_details: { cached_tokens: "9007199254740993" },
				total_tokens: "9007199254740993",
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

	it("returns undefined for non-object payloads", () => {
		expect(extractOpenAIResponsesUsage(null)).toBeUndefined();
		expect(extractOpenAIResponsesUsage("not-usage")).toBeUndefined();
	});
});

describe("convertResponsesMessages reasoning signature parsing", () => {
	const model = getModel("openai", "gpt-5-mini");
	const usage = {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};

	function createContext(thinkingSignature: string): Context {
		const assistant: AssistantMessage = {
			role: "assistant",
			content: [
				{ type: "thinking", thinking: "internal", thinkingSignature },
				{ type: "text", text: "done" },
			],
			api: "openai-responses",
			provider: "openai",
			model: "gpt-5-mini",
			usage,
			stopReason: "stop",
			timestamp: Date.now(),
		};

		return {
			messages: [{ role: "user", content: "hello", timestamp: Date.now() - 1 }, assistant],
		};
	}

	it("skips malformed thinking signatures instead of throwing", () => {
		const converted = convertResponsesMessages(model, createContext("{"), new Set(["openai"]), {
			includeSystemPrompt: false,
		});

		expect(
			converted.some(
				(item) => typeof item === "object" && item !== null && "type" in item && item.type === "reasoning",
			),
		).toBe(false);
		expect(converted.some((item) => typeof item === "object" && item !== null && "role" in item)).toBe(true);
	});

	it("preserves valid reasoning signatures", () => {
		const converted = convertResponsesMessages(
			model,
			createContext(
				JSON.stringify({
					type: "reasoning",
					id: "rs_test",
					summary: [{ type: "summary_text", text: "chain of thought summary" }],
				}),
			),
			new Set(["openai"]),
			{ includeSystemPrompt: false },
		);

		expect(
			converted.some(
				(item) =>
					typeof item === "object" &&
					item !== null &&
					"type" in item &&
					item.type === "reasoning" &&
					"id" in item &&
					item.id === "rs_test",
			),
		).toBe(true);
	});
});
