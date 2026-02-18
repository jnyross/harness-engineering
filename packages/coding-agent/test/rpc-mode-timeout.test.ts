import { describe, expect, it } from "vitest";
import { normalizeDialogTimeoutMs, parseRpcLine } from "../src/modes/rpc/rpc-mode.js";

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

describe("parseRpcLine", () => {
	it("returns parse errors for malformed payloads", () => {
		expect(parseRpcLine("not-json")).toEqual({
			kind: "error",
			message: expect.stringContaining("Invalid JSON payload"),
		});
		expect(parseRpcLine("42")).toEqual({
			kind: "error",
			message: "Expected command object payload",
		});
		expect(parseRpcLine("{}")).toEqual({
			kind: "error",
			message: "Missing command type",
		});
	});

	it("parses extension UI responses with valid ids", () => {
		expect(parseRpcLine('{"type":"extension_ui_response","id":"abc","cancelled":true}')).toEqual({
			kind: "extension_ui_response",
			response: { type: "extension_ui_response", id: "abc", cancelled: true },
		});
		expect(parseRpcLine('{"type":"extension_ui_response","id":" " }')).toEqual({
			kind: "error",
			message: "extension_ui_response requires non-empty string id",
		});
	});

	it("parses regular commands", () => {
		expect(parseRpcLine('{"type":"abort","id":"req_1"}')).toEqual({
			kind: "command",
			command: { type: "abort", id: "req_1" },
		});
	});
});
