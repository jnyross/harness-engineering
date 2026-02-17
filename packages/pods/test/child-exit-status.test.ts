import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSignalTerminationMessage, normalizeChildExitCode } from "../src/child-exit-status.js";

describe("child exit status helpers", () => {
	it("keeps explicit exit codes when no signal is present", () => {
		assert.equal(normalizeChildExitCode(0, null), 0);
		assert.equal(normalizeChildExitCode(5, null), 5);
	});

	it("maps signal terminations to non-zero exits", () => {
		assert.equal(normalizeChildExitCode(null, "SIGTERM"), 1);
		assert.equal(normalizeChildExitCode(0, "SIGTERM"), 1);
	});

	it("returns signal termination messages when signal is present", () => {
		assert.equal(getSignalTerminationMessage("SSH process", "SIGTERM"), "SSH process terminated by signal SIGTERM");
	});

	it("returns undefined message when process did not receive a signal", () => {
		assert.equal(getSignalTerminationMessage("SSH process", null), undefined);
	});
});
