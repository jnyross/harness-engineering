import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertValidModelId, isValidModelId } from "../src/model-id.js";

describe("model id validation", () => {
	it("accepts valid model ids", () => {
		const validIds = [
			"Qwen/Qwen2.5-Coder-32B-Instruct",
			"openai/gpt-oss-120b",
			"meta-llama/Llama-3.1-70B-Instruct",
			"zai-org/GLM-4.5",
			"local-model",
		];

		for (const modelId of validIds) {
			assert.equal(isValidModelId(modelId), true);
			assert.doesNotThrow(() => assertValidModelId(modelId));
		}
	});

	it("rejects unsafe model ids", () => {
		const invalidIds = ["", "'quoted'", "model with spaces", "model;rm -rf /", "`whoami`", "$HOME/model"];

		for (const modelId of invalidIds) {
			assert.equal(isValidModelId(modelId), false);
			assert.throws(() => assertValidModelId(modelId), /Invalid model id/);
		}
	});

	it("rejects model ids longer than 128 characters", () => {
		const tooLong = `model/${"a".repeat(128)}`;
		assert.equal(isValidModelId(tooLong), false);
		assert.throws(() => assertValidModelId(tooLong), /Invalid model id/);
	});
});
