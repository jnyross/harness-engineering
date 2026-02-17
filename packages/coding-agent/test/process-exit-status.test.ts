import { describe, expect, it } from "vitest";
import { normalizeProcessExitCode } from "../src/core/process-exit-status.js";

describe("normalizeProcessExitCode", () => {
	it("keeps explicit exit codes when no signal is present", () => {
		expect(normalizeProcessExitCode(0, null)).toBe(0);
		expect(normalizeProcessExitCode(7, null)).toBe(7);
	});

	it("maps signal exits to non-zero", () => {
		expect(normalizeProcessExitCode(0, "SIGTERM")).toBe(1);
		expect(normalizeProcessExitCode(null, "SIGKILL")).toBe(1);
	});

	it("maps unknown null/null exits to non-zero", () => {
		expect(normalizeProcessExitCode(null, null)).toBe(1);
	});
});
