import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getFindExitError } from "../src/core/tools/find-exit-status.js";

function createResult(overrides: Partial<SpawnSyncReturns<string>>): SpawnSyncReturns<string> {
	return {
		stdout: "",
		stderr: "",
		status: 0,
		signal: null,
		output: [],
		pid: 1,
		error: undefined,
		...overrides,
	} as SpawnSyncReturns<string>;
}

describe("getFindExitError", () => {
	it("returns undefined for successful exits", () => {
		expect(getFindExitError(createResult({ status: 0, stdout: "a.ts\n" }))).toBeUndefined();
	});

	it("returns startup failure errors", () => {
		expect(getFindExitError(createResult({ status: null, error: new Error("spawn fd ENOENT") }))).toBe(
			"Failed to run fd: spawn fd ENOENT",
		);
	});

	it("returns signal termination errors", () => {
		expect(getFindExitError(createResult({ status: null, signal: "SIGTERM" }))).toBe(
			"fd exited due to signal SIGTERM",
		);
	});

	it("returns unknown-status errors for null status without signal", () => {
		expect(getFindExitError(createResult({ status: null, signal: null }))).toBe("fd exited with unknown status");
	});

	it("returns stderr for non-zero exits with empty output", () => {
		expect(getFindExitError(createResult({ status: 2, stderr: "regex parse error\n" }))).toBe("regex parse error");
	});

	it("allows non-zero exits with partial stdout", () => {
		expect(
			getFindExitError(createResult({ status: 2, stdout: "partial-result\n", stderr: "warning" })),
		).toBeUndefined();
	});
});
