import { describe, expect, it } from "vitest";
import { normalizeChildExitCode } from "../src/child-exit-status.js";

describe("normalizeChildExitCode", () => {
	it("keeps explicit exit codes when no signal is present", () => {
		expect(normalizeChildExitCode(0, null)).toBe(0);
		expect(normalizeChildExitCode(9, null)).toBe(9);
	});

	it("maps signal exits to non-zero", () => {
		expect(normalizeChildExitCode(null, "SIGTERM")).toBe(1);
		expect(normalizeChildExitCode(0, "SIGKILL")).toBe(1);
	});

	it("maps unknown null/null exits to non-zero", () => {
		expect(normalizeChildExitCode(null, null)).toBe(1);
	});
});
