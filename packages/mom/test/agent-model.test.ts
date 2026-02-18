import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMomApiKey, resolveMomModel } from "../src/agent.js";

describe("resolveMomModel", () => {
	it("uses exact env overrides when provided", () => {
		const model = resolveMomModel({
			PI_MOM_PROVIDER: "anthropic",
			PI_MOM_MODEL: "claude-sonnet-4-5",
		});
		assert.equal(model.provider, "anthropic");
		assert.equal(model.id, "claude-sonnet-4-5");
	});

	it("rejects whitespace-padded env overrides and falls back to defaults", () => {
		const model = resolveMomModel({
			PI_MOM_PROVIDER: " invalid-provider ",
			PI_MOM_MODEL: " invalid-model ",
		});
		assert.equal(model.provider, "anthropic");
		assert.equal(model.id, "claude-sonnet-4-5");
	});

	it("falls back to defaults for blank env values", () => {
		const model = resolveMomModel({
			PI_MOM_PROVIDER: "   ",
			PI_MOM_MODEL: "",
		});
		assert.equal(model.provider, "anthropic");
		assert.equal(model.id, "claude-sonnet-4-5");
	});
});

describe("getMomApiKey", () => {
	it("requests credentials for the configured provider", async () => {
		let requestedProvider: string | undefined;
		const apiKey = await getMomApiKey(
			{
				getApiKey: async (providerId) => {
					requestedProvider = providerId;
					return "token-123";
				},
			},
			"openai",
		);
		assert.equal(apiKey, "token-123");
		assert.equal(requestedProvider, "openai");
	});

	it("throws a provider-specific error when key is missing", async () => {
		await assert.rejects(
			() =>
				getMomApiKey(
					{
						getApiKey: async () => undefined,
					},
					"anthropic",
				),
			/No API key found for provider "anthropic"\./,
		);
	});
});
