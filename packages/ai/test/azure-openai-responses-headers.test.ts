import { describe, expect, it, vi } from "vitest";
import { getModel } from "../src/models.js";
import { streamAzureOpenAIResponses } from "../src/providers/azure-openai-responses.js";
import type { Context } from "../src/types.js";

const mockState = vi.hoisted(() => ({
	constructorOpts: undefined as Record<string, unknown> | undefined,
}));

vi.mock("openai", () => {
	class FakeAzureOpenAI {
		constructor(opts: Record<string, unknown>) {
			mockState.constructorOpts = opts;
		}

		responses = {
			create: async () => ({
				async *[Symbol.asyncIterator]() {
					yield {
						type: "response.completed",
						response: {
							status: "completed",
							usage: {
								input_tokens: 1,
								output_tokens: 1,
								total_tokens: 2,
								input_tokens_details: { cached_tokens: 0 },
							},
						},
					};
				},
			}),
		};
	}

	return { AzureOpenAI: FakeAzureOpenAI };
});

describe("Azure OpenAI Responses custom header validation", () => {
	it("drops whitespace-padded custom header names from model/options headers", async () => {
		const model = getModel("azure-openai-responses", "gpt-4o-mini");
		const modelWithHeaders = {
			...model,
			headers: {
				...(model.headers ?? {}),
				"x-model-valid": "yes",
				" x-model-invalid ": "no",
			},
		};
		const context: Context = {
			messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
		};

		const result = await streamAzureOpenAIResponses(modelWithHeaders, context, {
			apiKey: "test",
			azureBaseUrl: "https://example.azure.com/openai/v1",
			azureDeploymentName: "gpt-4o-mini-deployment",
			headers: {
				"x-option-valid": "yes",
				" x-option-invalid ": "no",
				"": "blank",
			},
		}).result();

		expect(result.stopReason).toBe("stop");
		const headers = mockState.constructorOpts?.defaultHeaders as Record<string, string>;
		expect(headers["x-model-valid"]).toBe("yes");
		expect(headers["x-option-valid"]).toBe("yes");
		expect(Object.keys(headers)).not.toContain(" x-model-invalid ");
		expect(Object.keys(headers)).not.toContain(" x-option-invalid ");
		expect(Object.keys(headers)).not.toContain("");
	});
});
