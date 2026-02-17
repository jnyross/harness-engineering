import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { discoverLlamaCppModels, discoverVLLMModels } from "../src/utils/model-discovery.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("model discovery numeric parsing", () => {
	it("parses valid integer strings from llama.cpp model metadata", async () => {
		globalThis.fetch = async () =>
			new Response(
				JSON.stringify({
					data: [{ id: "llama-local", context_length: "16384", max_tokens: "2048" }],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);

		const models = await discoverLlamaCppModels("http://localhost:8080");
		assert.equal(models.length, 1);
		assert.equal(models[0]?.contextWindow, 16384);
		assert.equal(models[0]?.maxTokens, 2048);
	});

	it("falls back when llama.cpp metadata contains unsafe integer strings", async () => {
		globalThis.fetch = async () =>
			new Response(
				JSON.stringify({
					data: [{ id: "llama-local", context_length: "9007199254740993", max_tokens: "9007199254740993" }],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);

		const models = await discoverLlamaCppModels("http://localhost:8080");
		assert.equal(models.length, 1);
		assert.equal(models[0]?.contextWindow, 8192);
		assert.equal(models[0]?.maxTokens, 4096);
	});

	it("falls back when vLLM metadata contains unsafe integer values", async () => {
		globalThis.fetch = async () =>
			new Response(
				JSON.stringify({
					data: [{ id: "vllm-local", max_model_len: 9007199254740992 }],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);

		const models = await discoverVLLMModels("http://localhost:8000");
		assert.equal(models.length, 1);
		assert.equal(models[0]?.contextWindow, 8192);
		assert.equal(models[0]?.maxTokens, 4096);
	});
});
