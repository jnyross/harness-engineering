import { describe, expect, it } from "vitest";
import { normalizeRpcTimeoutMs } from "../src/modes/rpc/rpc-client.js";

describe("normalizeRpcTimeoutMs", () => {
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
});
