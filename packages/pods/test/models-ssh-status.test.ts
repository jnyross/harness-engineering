import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	getModelSshCommandError,
	parseModelRunnerPid,
	resolveModelContextTokens,
	resolveModelMemoryFraction,
} from "../src/commands/models.js";

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

describe("parseModelRunnerPid", () => {
	it("parses strict positive integer pid output", () => {
		assert.equal(parseModelRunnerPid("12345"), 12345);
		assert.equal(parseModelRunnerPid(" 987 \n"), 987);
	});

	it("rejects malformed or out-of-range pid output", () => {
		assert.equal(parseModelRunnerPid("123abc"), undefined);
		assert.equal(parseModelRunnerPid(""), undefined);
		assert.equal(parseModelRunnerPid("0"), undefined);
		assert.equal(parseModelRunnerPid("3000000000"), undefined);
	});
});

describe("resolveModelContextTokens", () => {
	it("resolves known context aliases", () => {
		assert.equal(resolveModelContextTokens("4k"), 4096);
		assert.equal(resolveModelContextTokens("64K"), 65536);
	});

	it("resolves explicit positive token counts", () => {
		assert.equal(resolveModelContextTokens("32768"), 32768);
		assert.equal(resolveModelContextTokens(" 4096 "), 4096);
	});

	it("rejects malformed context values", () => {
		assert.equal(resolveModelContextTokens("16k-extra"), undefined);
		assert.equal(resolveModelContextTokens("4096tokens"), undefined);
		assert.equal(resolveModelContextTokens("0"), undefined);
		assert.equal(resolveModelContextTokens("9007199254740993"), undefined);
	});
});

describe("resolveModelMemoryFraction", () => {
	it("accepts percent and numeric memory values", () => {
		assert.equal(resolveModelMemoryFraction("50%"), 0.5);
		assert.equal(resolveModelMemoryFraction("12.5"), 0.125);
		assert.equal(resolveModelMemoryFraction("100.0%"), 1);
	});

	it("rejects malformed or out-of-range memory values", () => {
		assert.equal(resolveModelMemoryFraction("0"), undefined);
		assert.equal(resolveModelMemoryFraction("101%"), undefined);
		assert.equal(resolveModelMemoryFraction("100.0000000000000000001"), undefined);
		assert.equal(resolveModelMemoryFraction("50percent"), undefined);
	});
});
