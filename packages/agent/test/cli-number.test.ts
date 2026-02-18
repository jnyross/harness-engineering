import { describe, expect, it } from "vitest";
import { parsePositiveIntegerOption } from "../src/cli-number.js";

describe("parsePositiveIntegerOption", () => {
	it("returns fallback for undefined or blank values", () => {
		expect(parsePositiveIntegerOption({ value: undefined, fallback: 3, optionName: "--iterations" })).toBe(3);
		expect(parsePositiveIntegerOption({ value: "   ", fallback: 7, optionName: "--max-tasks" })).toBe(7);
	});

	it("parses positive integer values", () => {
		expect(parsePositiveIntegerOption({ value: "5", fallback: 1, optionName: "--iterations" })).toBe(5);
		expect(parsePositiveIntegerOption({ value: "12", fallback: 1, optionName: "--max-tasks" })).toBe(12);
	});

	it("rejects non-numeric, non-positive, and whitespace-padded values", () => {
		expect(() => parsePositiveIntegerOption({ value: "1task", fallback: 1, optionName: "--iterations" })).toThrow(
			"Invalid --iterations value '1task'. Use a positive integer.",
		);
		expect(() => parsePositiveIntegerOption({ value: "0", fallback: 1, optionName: "--iterations" })).toThrow(
			"Invalid --iterations value '0'. Use a positive integer.",
		);
		expect(() => parsePositiveIntegerOption({ value: "-2", fallback: 1, optionName: "--max-tasks" })).toThrow(
			"Invalid --max-tasks value '-2'. Use a positive integer.",
		);
		expect(() =>
			parsePositiveIntegerOption({
				value: "9007199254740993",
				fallback: 1,
				optionName: "--iterations",
			}),
		).toThrow("Invalid --iterations value '9007199254740993'. Use a positive integer.");
		expect(() => parsePositiveIntegerOption({ value: " 12 ", fallback: 1, optionName: "--max-tasks" })).toThrow(
			"Invalid --max-tasks value ' 12 '. Use a positive integer.",
		);
	});
});
