import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertValidModelInstanceName, isValidModelInstanceName } from "../src/model-name.js";

describe("model instance naming", () => {
	it("accepts valid names", () => {
		const validNames = ["qwen", "qwen-32b", "glm_45", "gpt.oss", "a", "model123"];
		for (const name of validNames) {
			assert.equal(isValidModelInstanceName(name), true);
			assert.doesNotThrow(() => assertValidModelInstanceName(name));
		}
	});

	it("rejects invalid names", () => {
		const invalidNames = ["", "-starts-with-dash", "has space", "slash/name", "semi;colon"];
		for (const name of invalidNames) {
			assert.equal(isValidModelInstanceName(name), false);
			assert.throws(() => assertValidModelInstanceName(name), /Invalid model instance name/);
		}
	});

	it("rejects names longer than 64 characters", () => {
		const tooLong = "a".repeat(65);
		assert.equal(isValidModelInstanceName(tooLong), false);
		assert.throws(() => assertValidModelInstanceName(tooLong), /Invalid model instance name/);
	});
});
