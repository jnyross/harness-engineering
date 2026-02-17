import { describe, expect, it } from "vitest";
import { parseProviderSelection } from "../src/cli-selection.js";

describe("parseProviderSelection", () => {
	it("parses valid selections as zero-based indices", () => {
		expect(parseProviderSelection("1", 4)).toBe(0);
		expect(parseProviderSelection(" 3 ", 4)).toBe(2);
		expect(parseProviderSelection("4", 4)).toBe(3);
	});

	it("rejects malformed and out-of-range selections", () => {
		expect(parseProviderSelection("0", 4)).toBeUndefined();
		expect(parseProviderSelection("5", 4)).toBeUndefined();
		expect(parseProviderSelection("2provider", 4)).toBeUndefined();
		expect(parseProviderSelection("-1", 4)).toBeUndefined();
		expect(parseProviderSelection("", 4)).toBeUndefined();
		expect(parseProviderSelection("9007199254740993", 4)).toBeUndefined();
	});
});
