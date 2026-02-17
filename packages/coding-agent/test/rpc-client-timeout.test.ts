import { describe, expect, it } from "vitest";
import { normalizeRpcTimeoutMs } from "../src/modes/rpc/rpc-client.js";

describe("normalizeRpcTimeoutMs", () => {
	it("falls back to default timeout for invalid non-positive values", () => {
		expect(normalizeRpcTimeoutMs(0)).toBe(60_000);
		expect(normalizeRpcTimeoutMs(-1)).toBe(60_000);
		expect(normalizeRpcTimeoutMs(Number.NaN)).toBe(60_000);
	});

	it("preserves timeout values within Node timer range", () => {
		expect(normalizeRpcTimeoutMs(1)).toBe(1);
		expect(normalizeRpcTimeoutMs(60_000)).toBe(60_000);
		expect(normalizeRpcTimeoutMs(2_147_483_647)).toBe(2_147_483_647);
	});

	it("clamps oversized timeout values to Node timer max", () => {
		expect(normalizeRpcTimeoutMs(2_147_483_648)).toBe(2_147_483_647);
		expect(normalizeRpcTimeoutMs(Number.MAX_SAFE_INTEGER)).toBe(2_147_483_647);
		expect(normalizeRpcTimeoutMs(Number.POSITIVE_INFINITY)).toBe(2_147_483_647);
	});

	it("allows custom fallback timeout values", () => {
		expect(normalizeRpcTimeoutMs(0, 15_000)).toBe(15_000);
	});
});
