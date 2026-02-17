import { describe, expect, it } from "vitest";
import { getSubagentProcessExitStatus } from "../examples/extensions/subagent/subagent-exit-status.js";

describe("getSubagentProcessExitStatus", () => {
	it("returns success for clean exits", () => {
		expect(getSubagentProcessExitStatus(0, null)).toEqual({ exitCode: 0 });
	});

	it("reports signal-terminated subagent exits", () => {
		expect(getSubagentProcessExitStatus(null, "SIGTERM")).toEqual({
			exitCode: 1,
			failureReason: "Subagent process terminated by signal SIGTERM",
		});
	});

	it("reports unknown null/null subagent exits", () => {
		expect(getSubagentProcessExitStatus(null, null)).toEqual({
			exitCode: 1,
			failureReason: "Subagent process exited with unknown status",
		});
	});

	it("preserves non-zero exit codes with diagnostics", () => {
		expect(getSubagentProcessExitStatus(13, null)).toEqual({
			exitCode: 13,
			failureReason: "Subagent process exited with code 13",
		});
	});
});
