import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPromptAgentExitError } from "../src/commands/prompt.js";

describe("getPromptAgentExitError", () => {
	it("returns undefined for successful exits", () => {
		assert.equal(getPromptAgentExitError(0, null), undefined);
	});

	it("reports signal exits", () => {
		assert.equal(getPromptAgentExitError(null, "SIGTERM"), "Agent process exited due to signal SIGTERM");
	});

	it("reports unknown null/null exits", () => {
		assert.equal(getPromptAgentExitError(null, null), "Agent process exited with unknown status");
	});

	it("reports non-zero exit codes", () => {
		assert.equal(getPromptAgentExitError(17, null), "Agent process exited with code 17");
	});
});
