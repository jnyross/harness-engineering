import { describe, expect, it } from "vitest";
import { getRpcExtensionExitReason, normalizeRpcExtensionExitCode } from "../examples/rpc-extension-exit-status.js";

describe("rpc extension exit status helpers", () => {
	it("normalizes successful and explicit non-zero exit codes", () => {
		expect(normalizeRpcExtensionExitCode(0, null)).toBe(0);
		expect(normalizeRpcExtensionExitCode(17, null)).toBe(17);
	});

	it("maps signal and unknown null/null exits to non-zero", () => {
		expect(normalizeRpcExtensionExitCode(null, "SIGTERM")).toBe(1);
		expect(normalizeRpcExtensionExitCode(null, null)).toBe(1);
	});

	it("formats signal and code reasons", () => {
		expect(getRpcExtensionExitReason(null, "SIGKILL")).toBe("signal SIGKILL");
		expect(getRpcExtensionExitReason(9, null)).toBe("code 9");
	});

	it("formats unknown null/null reason explicitly", () => {
		expect(getRpcExtensionExitReason(null, null)).toBe("unknown status");
	});
});
