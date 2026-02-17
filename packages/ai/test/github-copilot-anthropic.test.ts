import { describe, expect, it, vi } from "vitest";
import { getModel } from "../src/models.js";
import type { Context } from "../src/types.js";

const mockState = vi.hoisted(() => ({
	constructorOpts: undefined as Record<string, unknown> | undefined,
	streamParams: undefined as Record<string, unknown> | undefined,
	useStringUsage: false,
	useMalformedUsage: false,
	useNonDecimalUsage: false,
	useUnsafeUsage: false,
}));

vi.mock("@anthropic-ai/sdk", () => {
	const fakeStream = {
		async *[Symbol.asyncIterator]() {
			const toUsageValue = (
				value: number,
				options?: { malformed?: string; malformedNumber?: number },
			): number | string => {
				if (mockState.useNonDecimalUsage) {
					if (options?.malformedNumber !== undefined) {
						return String(options.malformedNumber);
					}
					return "0x10";
				}
				if (mockState.useUnsafeUsage) {
					return "9007199254740993";
				}
				if (mockState.useMalformedUsage) {
					if (options?.malformed !== undefined) {
						return options.malformed;
					}
					if (options?.malformedNumber !== undefined) {
						return options.malformedNumber;
					}
				}
				return mockState.useStringUsage ? String(value) : value;
			};
			yield {
				type: "message_start",
				message: {
					usage: {
						input_tokens: toUsageValue(10, { malformed: "-4" }),
						output_tokens: toUsageValue(0, { malformed: "1.9" }),
						cache_creation_input_tokens: toUsageValue(1, { malformed: "-3" }),
						cache_read_input_tokens: toUsageValue(2, { malformed: "oops" }),
					},
				},
			};
			yield {
				type: "message_delta",
				delta: { stop_reason: "end_turn" },
				usage: {
					output_tokens: toUsageValue(5, { malformed: "2.8" }),
					cache_creation_input_tokens: toUsageValue(1, { malformed: "1.2" }),
					cache_read_input_tokens: toUsageValue(2, { malformed: "2.7" }),
				},
			};
		},
		finalMessage: async () => ({
			usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
		}),
	};

	class FakeAnthropic {
		constructor(opts: Record<string, unknown>) {
			mockState.constructorOpts = opts;
		}
		messages = {
			stream: (params: Record<string, unknown>) => {
				mockState.streamParams = params;
				return fakeStream;
			},
		};
	}

	return { default: FakeAnthropic };
});

describe("Copilot Claude via Anthropic Messages", () => {
	const context: Context = {
		systemPrompt: "You are a helpful assistant.",
		messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
	};

	it("uses Bearer auth, Copilot headers, and valid Anthropic Messages payload", async () => {
		mockState.useStringUsage = false;
		mockState.useMalformedUsage = false;
		mockState.useNonDecimalUsage = false;
		mockState.useUnsafeUsage = false;
		const model = getModel("github-copilot", "claude-sonnet-4");
		expect(model.api).toBe("anthropic-messages");

		const { streamAnthropic } = await import("../src/providers/anthropic.js");
		const s = streamAnthropic(model, context, { apiKey: "tid_copilot_session_test_token" });
		for await (const event of s) {
			if (event.type === "error") break;
		}

		const opts = mockState.constructorOpts!;
		expect(opts).toBeDefined();

		// Auth: apiKey null, authToken for Bearer
		expect(opts.apiKey).toBeNull();
		expect(opts.authToken).toBe("tid_copilot_session_test_token");
		const headers = opts.defaultHeaders as Record<string, string>;

		// Copilot static headers from model.headers
		expect(headers["User-Agent"]).toContain("GitHubCopilotChat");
		expect(headers["Copilot-Integration-Id"]).toBe("vscode-chat");

		// Dynamic headers
		expect(headers["X-Initiator"]).toBe("user");
		expect(headers["Openai-Intent"]).toBe("conversation-edits");

		// No fine-grained-tool-streaming (Copilot doesn't support it)
		const beta = headers["anthropic-beta"] ?? "";
		expect(beta).not.toContain("fine-grained-tool-streaming");

		// Payload is valid Anthropic Messages format
		const params = mockState.streamParams!;
		expect(params.model).toBe("claude-sonnet-4");
		expect(params.stream).toBe(true);
		expect(params.max_tokens).toBeGreaterThan(0);
		expect(Array.isArray(params.messages)).toBe(true);
	});

	it("includes interleaved-thinking beta when reasoning is enabled", async () => {
		mockState.useStringUsage = false;
		mockState.useMalformedUsage = false;
		mockState.useNonDecimalUsage = false;
		mockState.useUnsafeUsage = false;
		const model = getModel("github-copilot", "claude-sonnet-4");
		const { streamAnthropic } = await import("../src/providers/anthropic.js");
		const s = streamAnthropic(model, context, {
			apiKey: "tid_copilot_session_test_token",
			interleavedThinking: true,
		});
		for await (const event of s) {
			if (event.type === "error") break;
		}

		const headers = mockState.constructorOpts!.defaultHeaders as Record<string, string>;
		expect(headers["anthropic-beta"]).toContain("interleaved-thinking-2025-05-14");
	});

	it("normalizes numeric-string usage counters from Anthropic stream events", async () => {
		mockState.useStringUsage = true;
		mockState.useMalformedUsage = false;
		mockState.useNonDecimalUsage = false;
		mockState.useUnsafeUsage = false;
		const model = getModel("github-copilot", "claude-sonnet-4");
		const { streamAnthropic } = await import("../src/providers/anthropic.js");
		const result = await streamAnthropic(model, context, { apiKey: "tid_copilot_session_test_token" }).result();

		expect(result.usage.input).toBe(10);
		expect(result.usage.output).toBe(5);
		expect(result.usage.cacheRead).toBe(2);
		expect(result.usage.cacheWrite).toBe(1);
		expect(result.usage.totalTokens).toBe(18);
	});

	it("ignores malformed and negative usage counters from Anthropic stream events", async () => {
		mockState.useStringUsage = false;
		mockState.useMalformedUsage = true;
		mockState.useNonDecimalUsage = false;
		mockState.useUnsafeUsage = false;
		const model = getModel("github-copilot", "claude-sonnet-4");
		const { streamAnthropic } = await import("../src/providers/anthropic.js");
		const result = await streamAnthropic(model, context, { apiKey: "tid_copilot_session_test_token" }).result();

		expect(result.usage.input).toBe(0);
		expect(result.usage.output).toBe(2);
		expect(result.usage.cacheRead).toBe(2);
		expect(result.usage.cacheWrite).toBe(1);
		expect(result.usage.totalTokens).toBe(5);
	});

	it("ignores non-decimal numeric string usage counters from Anthropic stream events", async () => {
		mockState.useStringUsage = false;
		mockState.useMalformedUsage = false;
		mockState.useNonDecimalUsage = true;
		mockState.useUnsafeUsage = false;
		const model = getModel("github-copilot", "claude-sonnet-4");
		const { streamAnthropic } = await import("../src/providers/anthropic.js");
		const result = await streamAnthropic(model, context, { apiKey: "tid_copilot_session_test_token" }).result();

		expect(result.usage.input).toBe(0);
		expect(result.usage.output).toBe(0);
		expect(result.usage.cacheRead).toBe(0);
		expect(result.usage.cacheWrite).toBe(0);
		expect(result.usage.totalTokens).toBe(0);
	});

	it("ignores unsafe integer usage counters from Anthropic stream events", async () => {
		mockState.useStringUsage = false;
		mockState.useMalformedUsage = false;
		mockState.useNonDecimalUsage = false;
		mockState.useUnsafeUsage = true;
		const model = getModel("github-copilot", "claude-sonnet-4");
		const { streamAnthropic } = await import("../src/providers/anthropic.js");
		const result = await streamAnthropic(model, context, { apiKey: "tid_copilot_session_test_token" }).result();

		expect(result.usage.input).toBe(0);
		expect(result.usage.output).toBe(0);
		expect(result.usage.cacheRead).toBe(0);
		expect(result.usage.cacheWrite).toBe(0);
		expect(result.usage.totalTokens).toBe(0);
	});
});
