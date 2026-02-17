import { describe, expect, it } from "vitest";
import { normalizeDialogTimeoutMs } from "../src/modes/rpc/rpc-mode.js";

describe("normalizeDialogTimeoutMs", () => {
	it("returns undefined for missing or non-positive timeout values", () => {
		expect(normalizeDialogTimeoutMs(undefined)).toBeUndefined();
		expect(normalizeDialogTimeoutMs(0)).toBeUndefined();
		expect(normalizeDialogTimeoutMs(-1)).toBeUndefined();
		expect(normalizeDialogTimeoutMs(Number.NaN)).toBeUndefined();
	});

	it("preserves valid timeout values within timer range", () => {
		expect(normalizeDialogTimeoutMs(1)).toBe(1);
		expect(normalizeDialogTimeoutMs(5000)).toBe(5000);
		expect(normalizeDialogTimeoutMs(2_147_483_647)).toBe(2_147_483_647);
	});

	it("clamps oversized timeout values to Node timer max", () => {
		expect(normalizeDialogTimeoutMs(2_147_483_648)).toBe(2_147_483_647);
		expect(normalizeDialogTimeoutMs(Number.MAX_SAFE_INTEGER)).toBe(2_147_483_647);
		expect(normalizeDialogTimeoutMs(Number.POSITIVE_INFINITY)).toBe(2_147_483_647);
	});
});
