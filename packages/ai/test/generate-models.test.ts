import { describe, expect, it } from "vitest";
import { parseNonNegativeNumericValue } from "../scripts/generate-models.js";

describe("parseNonNegativeNumericValue", () => {
	it("parses non-negative numbers and decimal strings", () => {
		expect(parseNonNegativeNumericValue(0)).toBe(0);
		expect(parseNonNegativeNumericValue(12.5)).toBe(12.5);
		expect(parseNonNegativeNumericValue("42")).toBe(42);
		expect(parseNonNegativeNumericValue("0.125")).toBe(0.125);
	});

	it("returns zero for malformed, non-decimal, or negative values", () => {
		expect(parseNonNegativeNumericValue(undefined)).toBe(0);
		expect(parseNonNegativeNumericValue("")).toBe(0);
		expect(parseNonNegativeNumericValue("-1")).toBe(0);
		expect(parseNonNegativeNumericValue("0x10")).toBe(0);
		expect(parseNonNegativeNumericValue("1e2")).toBe(0);
		expect(parseNonNegativeNumericValue(".5")).toBe(0);
		expect(parseNonNegativeNumericValue(Number.NaN)).toBe(0);
		expect(parseNonNegativeNumericValue(Number.POSITIVE_INFINITY)).toBe(0);
	});
});
