import { afterEach, describe, expect, it, vi } from "vitest";
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
	const originalAzureBaseUrl = process.env.AZURE_OPENAI_BASE_URL;
	const originalAzureResourceName = process.env.AZURE_OPENAI_RESOURCE_NAME;

	afterEach(() => {
		mockState.constructorOpts = undefined;
		if (originalAzureBaseUrl === undefined) {
			delete process.env.AZURE_OPENAI_BASE_URL;
		} else {
			process.env.AZURE_OPENAI_BASE_URL = originalAzureBaseUrl;
		}
		if (originalAzureResourceName === undefined) {
			delete process.env.AZURE_OPENAI_RESOURCE_NAME;
		} else {
			process.env.AZURE_OPENAI_RESOURCE_NAME = originalAzureResourceName;
		}
	});

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

	it("ignores whitespace-padded option base URLs and falls back to model baseUrl", async () => {
		delete process.env.AZURE_OPENAI_BASE_URL;
		delete process.env.AZURE_OPENAI_RESOURCE_NAME;
		const model = getModel("azure-openai-responses", "gpt-4o-mini");
		const modelWithBaseUrl = {
			...model,
			baseUrl: "https://model.azure.com/openai/v1/",
		};
		const context: Context = {
			messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
		};

		const result = await streamAzureOpenAIResponses(modelWithBaseUrl, context, {
			apiKey: "test",
			azureBaseUrl: " https://option.azure.com/openai/v1 ",
			azureDeploymentName: "gpt-4o-mini-deployment",
		}).result();

		expect(result.stopReason).toBe("stop");
		expect(mockState.constructorOpts?.baseURL).toBe("https://model.azure.com/openai/v1");
	});

	it("ignores whitespace-padded env base URLs and falls back to model baseUrl", async () => {
		process.env.AZURE_OPENAI_BASE_URL = " https://env.azure.com/openai/v1 ";
		delete process.env.AZURE_OPENAI_RESOURCE_NAME;
		const model = getModel("azure-openai-responses", "gpt-4o-mini");
		const modelWithBaseUrl = {
			...model,
			baseUrl: "https://model.azure.com/openai/v1/",
		};
		const context: Context = {
			messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
		};

		const result = await streamAzureOpenAIResponses(modelWithBaseUrl, context, {
			apiKey: "test",
			azureDeploymentName: "gpt-4o-mini-deployment",
		}).result();

		expect(result.stopReason).toBe("stop");
		expect(mockState.constructorOpts?.baseURL).toBe("https://model.azure.com/openai/v1");
	});
});
