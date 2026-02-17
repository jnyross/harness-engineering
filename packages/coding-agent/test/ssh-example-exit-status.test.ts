import { describe, expect, it } from "vitest";
import { getSshExampleFailureReason, normalizeSshExampleExitCode } from "../examples/extensions/ssh-exit-status.js";

describe("ssh example exit status helpers", () => {
	it("normalizes successful and explicit non-zero exits", () => {
		expect(normalizeSshExampleExitCode(0, null)).toBe(0);
		expect(normalizeSshExampleExitCode(23, null)).toBe(23);
	});

	it("maps signal and unknown null/null exits to non-zero", () => {
		expect(normalizeSshExampleExitCode(null, "SIGTERM")).toBe(1);
		expect(normalizeSshExampleExitCode(null, null)).toBe(1);
	});

	it("formats failure reasons for signal, explicit, and unknown exits", () => {
		expect(getSshExampleFailureReason(null, "SIGKILL")).toBe("signal SIGKILL");
		expect(getSshExampleFailureReason(9, null)).toBe("code 9");
		expect(getSshExampleFailureReason(null, null)).toBe("unknown status");
	});
});
