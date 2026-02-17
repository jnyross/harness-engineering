import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getInteractiveShellExitStatus } from "../examples/extensions/interactive-shell.js";

function createResult(overrides: Partial<SpawnSyncReturns<Buffer>>): SpawnSyncReturns<Buffer> {
	return {
		pid: 1,
		output: [Buffer.alloc(0), Buffer.alloc(0), Buffer.alloc(0)],
		stdout: Buffer.alloc(0),
		stderr: Buffer.alloc(0),
		status: 0,
		signal: null,
		error: undefined,
		...overrides,
	};
}

describe("getInteractiveShellExitStatus", () => {
	it("returns success for status 0", () => {
		expect(getInteractiveShellExitStatus(createResult({ status: 0 }))).toEqual({ exitCode: 0 });
	});

	it("reports shell startup failures", () => {
		expect(getInteractiveShellExitStatus(createResult({ status: null, error: new Error("spawn ENOENT") }))).toEqual({
			exitCode: 1,
			failureReason: "failed to start shell: spawn ENOENT",
		});
	});

	it("reports signal exits", () => {
		expect(getInteractiveShellExitStatus(createResult({ status: null, signal: "SIGTERM" }))).toEqual({
			exitCode: 1,
			failureReason: "terminated by signal SIGTERM",
		});
	});

	it("treats unknown null/null closes as failures", () => {
		expect(getInteractiveShellExitStatus(createResult({ status: null, signal: null }))).toEqual({
			exitCode: 1,
			failureReason: "exited with unknown status",
		});
	});

	it("preserves non-zero exit codes", () => {
		expect(getInteractiveShellExitStatus(createResult({ status: 27 }))).toEqual({
			exitCode: 27,
			failureReason: "exited with code 27",
		});
	});
});
