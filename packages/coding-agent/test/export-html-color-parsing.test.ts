import { describe, expect, it } from "vitest";
import { parseExportColor } from "../src/core/export-html/index.js";

describe("parseExportColor", () => {
	it("parses valid hex and rgb colors", () => {
		expect(parseExportColor("#0a1b2c")).toEqual({ r: 10, g: 27, b: 44 });
		expect(parseExportColor("rgb(12, 34, 56)")).toEqual({ r: 12, g: 34, b: 56 });
	});

	it("rejects out-of-range or unsafe rgb components", () => {
		expect(parseExportColor("rgb(256, 0, 0)")).toBeUndefined();
		expect(parseExportColor("rgb(9007199254740993, 0, 0)")).toBeUndefined();
		expect(parseExportColor("rgb(-1, 0, 0)")).toBeUndefined();
	});
});
