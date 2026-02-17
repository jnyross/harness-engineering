import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getModelSshCommandError } from "../src/commands/models.js";

describe("getModelSshCommandError", () => {
	it("returns undefined for successful SSH results", () => {
		assert.equal(
			getModelSshCommandError({
				action: "Checking model status",
				result: { stdout: "running", stderr: "", exitCode: 0 },
			}),
			undefined,
		);
	});

	it("prefers stderr diagnostics for failed SSH results", () => {
		assert.equal(
			getModelSshCommandError({
				action: "Stopping model",
				result: { stdout: "", stderr: "Permission denied", exitCode: 255 },
			}),
			"Stopping model failed: Permission denied",
		);
	});

	it("falls back to stdout diagnostics when stderr is empty", () => {
		assert.equal(
			getModelSshCommandError({
				action: "Starting model runner",
				result: { stdout: "unexpected output", stderr: "", exitCode: 1 },
			}),
			"Starting model runner failed: unexpected output",
		);
	});

	it("falls back to exit-code diagnostics when no output exists", () => {
		assert.equal(
			getModelSshCommandError({
				action: "Uploading startup script",
				result: { stdout: "", stderr: "", exitCode: 17 },
			}),
			"Uploading startup script failed: SSH command exited with code 17",
		);
	});
});
