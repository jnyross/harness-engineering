import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPromptAgentExitError } from "../src/commands/prompt.js";

const invokedCommand = "npx --yes --package @mariozechner/pi-coding-agent pi --model demo";

describe("getPromptAgentExitError", () => {
	it("returns undefined for successful exits", () => {
		assert.equal(getPromptAgentExitError({ code: 0, signal: null, invokedCommand }), undefined);
	});

	it("reports signal exits", () => {
		assert.equal(
			getPromptAgentExitError({ code: null, signal: "SIGTERM", invokedCommand }),
			`Agent command '${invokedCommand}' exited due to signal SIGTERM`,
		);
	});

	it("reports unknown null/null exits", () => {
		assert.equal(
			getPromptAgentExitError({ code: null, signal: null, invokedCommand }),
			`Agent command '${invokedCommand}' exited with unknown status`,
		);
	});

	it("reports non-zero exit codes", () => {
		assert.equal(
			getPromptAgentExitError({ code: 17, signal: null, invokedCommand }),
			`Agent command '${invokedCommand}' exited with code 17`,
		);
	});
});
