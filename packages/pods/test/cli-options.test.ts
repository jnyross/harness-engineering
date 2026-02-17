import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readRequiredOptionValue } from "../src/cli-options.js";

describe("readRequiredOptionValue", () => {
	it("returns option values when present", () => {
		assert.equal(readRequiredOptionValue(["start", "--name", "demo"], 1, "--name"), "demo");
		assert.equal(readRequiredOptionValue(["pods", "setup", "--vllm", "nightly"], 2, "--vllm"), "nightly");
	});

	it("rejects missing values", () => {
		assert.throws(
			() => readRequiredOptionValue(["start", "--name"], 1, "--name"),
			/Option --name requires a value\./,
		);
	});

	it("rejects option-like next tokens", () => {
		assert.throws(
			() => readRequiredOptionValue(["start", "--context", "--memory"], 1, "--context"),
			/Option --context requires a value\./,
		);
		assert.throws(
			() => readRequiredOptionValue(["start", "--context", "-m"], 1, "--context"),
			/Option --context requires a value\./,
		);
	});
});
