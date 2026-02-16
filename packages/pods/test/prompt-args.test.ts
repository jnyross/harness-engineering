import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createProviderName, findReservedFlag } from "../src/commands/prompt-args.js";

describe("findReservedFlag", () => {
	it("detects reserved provider and model flags", () => {
		assert.equal(findReservedFlag(["hello", "--provider", "openai"]), "--provider");
		assert.equal(findReservedFlag(["hello", "--model=gpt-5"]), "--model");
	});

	it("returns undefined when reserved flags are absent", () => {
		assert.equal(findReservedFlag(["--json", "status"]), undefined);
	});

	it("ignores potential reserved flags after -- terminator", () => {
		assert.equal(findReservedFlag(["ask", "--", "--provider", "openai"]), undefined);
	});
});

describe("createProviderName", () => {
	it("uses pods-vllm prefix by default", () => {
		assert.match(createProviderName(), /^pods-vllm-[0-9a-f]{8}$/);
	});

	it("supports custom prefixes", () => {
		assert.match(createProviderName("custom-provider"), /^custom-provider-[0-9a-f]{8}$/);
	});
});
