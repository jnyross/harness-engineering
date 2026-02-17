import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";
import { getModel } from "../src/models.js";
import { streamSimple } from "../src/stream.js";
import type { Tool } from "../src/types.js";

const mockState = vi.hoisted(
	() =>
		({
			lastParams: undefined as unknown,
			usageAsStrings: false,
			usageMalformed: false,
			usageNonDecimal: false,
		}) as { lastParams: unknown; usageAsStrings: boolean; usageMalformed: boolean; usageNonDecimal: boolean },
);

vi.mock("openai", () => {
	class FakeOpenAI {
		chat = {
			completions: {
				create: async (params: unknown) => {
					mockState.lastParams = params;
					return {
						async *[Symbol.asyncIterator]() {
							const promptTokens = mockState.usageNonDecimal
								? "0x10"
								: mockState.usageMalformed
									? "-4"
									: mockState.usageAsStrings
										? "5"
										: 5;
							const completionTokens = mockState.usageNonDecimal
								? "1e2"
								: mockState.usageMalformed
									? "2.9"
									: mockState.usageAsStrings
										? "2"
										: 2;
							const cachedTokens = mockState.usageNonDecimal
								? "0x3"
								: mockState.usageMalformed
									? "1.8"
									: mockState.usageAsStrings
										? "3"
										: 3;
							const reasoningTokens = mockState.usageNonDecimal
								? "2.9"
								: mockState.usageMalformed
									? "-7"
									: mockState.usageAsStrings
										? "4"
										: 4;
							yield {
								choices: [{ delta: {}, finish_reason: "stop" }],
								usage: {
									prompt_tokens: promptTokens,
									completion_tokens: completionTokens,
									prompt_tokens_details: { cached_tokens: cachedTokens },
									completion_tokens_details: { reasoning_tokens: reasoningTokens },
								},
							};
						},
					};
				},
			},
		};
	}

	return { default: FakeOpenAI };
});

describe("openai-completions tool_choice", () => {
	it("forwards toolChoice from simple options to payload", async () => {
		mockState.usageAsStrings = false;
		mockState.usageMalformed = false;
		mockState.usageNonDecimal = false;
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		const model = { ...baseModel, api: "openai-completions" } as const;
		const tools: Tool[] = [
			{
				name: "ping",
				description: "Ping tool",
				parameters: Type.Object({
					ok: Type.Boolean(),
				}),
			},
		];
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Call ping with ok=true",
						timestamp: Date.now(),
					},
				],
				tools,
			},
			{
				apiKey: "test",
				toolChoice: "required",
				onPayload: (params: unknown) => {
					payload = params;
				},
			} as unknown as Parameters<typeof streamSimple>[2],
		).result();

		const params = (payload ?? mockState.lastParams) as { tool_choice?: string; tools?: unknown[] };
		expect(params.tool_choice).toBe("required");
		expect(Array.isArray(params.tools)).toBe(true);
		expect(params.tools?.length ?? 0).toBeGreaterThan(0);
	});

	it("omits strict when compat disables strict mode", async () => {
		mockState.usageAsStrings = false;
		mockState.usageMalformed = false;
		mockState.usageNonDecimal = false;
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		const model = {
			...baseModel,
			api: "openai-completions",
			compat: { supportsStrictMode: false },
		} as const;
		const tools: Tool[] = [
			{
				name: "ping",
				description: "Ping tool",
				parameters: Type.Object({
					ok: Type.Boolean(),
				}),
			},
		];
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Call ping with ok=true",
						timestamp: Date.now(),
					},
				],
				tools,
			},
			{
				apiKey: "test",
				onPayload: (params: unknown) => {
					payload = params;
				},
			} as unknown as Parameters<typeof streamSimple>[2],
		).result();

		const params = (payload ?? mockState.lastParams) as { tools?: Array<{ function?: Record<string, unknown> }> };
		const tool = params.tools?.[0]?.function;
		expect(tool).toBeTruthy();
		expect(tool?.strict).toBeUndefined();
		expect("strict" in (tool ?? {})).toBe(false);
	});

	it("normalizes numeric-string usage counters from compatible APIs", async () => {
		mockState.usageAsStrings = true;
		mockState.usageMalformed = false;
		mockState.usageNonDecimal = false;
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		const model = { ...baseModel, api: "openai-completions" } as const;

		const stream = await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "hello",
						timestamp: Date.now(),
					},
				],
			},
			{ apiKey: "test" },
		).result();

		expect(stream.usage.input).toBe(2);
		expect(stream.usage.output).toBe(6);
		expect(stream.usage.cacheRead).toBe(3);
		expect(stream.usage.totalTokens).toBe(11);
	});

	it("ignores malformed and negative usage counters from compatible APIs", async () => {
		mockState.usageAsStrings = false;
		mockState.usageMalformed = true;
		mockState.usageNonDecimal = false;
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		const model = { ...baseModel, api: "openai-completions" } as const;

		const stream = await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "hello",
						timestamp: Date.now(),
					},
				],
			},
			{ apiKey: "test" },
		).result();

		expect(stream.usage.input).toBe(0);
		expect(stream.usage.output).toBe(2);
		expect(stream.usage.cacheRead).toBe(1);
		expect(stream.usage.totalTokens).toBe(3);
	});

	it("ignores non-decimal numeric string usage counters", async () => {
		mockState.usageAsStrings = false;
		mockState.usageMalformed = false;
		mockState.usageNonDecimal = true;
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		const model = { ...baseModel, api: "openai-completions" } as const;

		const stream = await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "hello",
						timestamp: Date.now(),
					},
				],
			},
			{ apiKey: "test" },
		).result();

		expect(stream.usage.input).toBe(0);
		expect(stream.usage.output).toBe(2);
		expect(stream.usage.cacheRead).toBe(0);
		expect(stream.usage.totalTokens).toBe(2);
	});
});
