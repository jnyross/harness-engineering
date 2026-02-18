import { describe, expect, it } from "vitest";
import { parseSettingsIntegerValue } from "../src/modes/interactive/components/settings-selector.js";

describe("parseSettingsIntegerValue", () => {
	it("parses valid decimal integer values", () => {
		expect(parseSettingsIntegerValue("0")).toBe(0);
		expect(parseSettingsIntegerValue("3")).toBe(3);
		expect(parseSettingsIntegerValue("20")).toBe(20);
	});

	it("rejects malformed or unsafe integer values", () => {
		expect(parseSettingsIntegerValue("3foo")).toBeUndefined();
		expect(parseSettingsIntegerValue("0x10")).toBeUndefined();
		expect(parseSettingsIntegerValue("1e2")).toBeUndefined();
		expect(parseSettingsIntegerValue(" 3 ")).toBeUndefined();
		expect(parseSettingsIntegerValue("9007199254740993")).toBeUndefined();
	});
});
