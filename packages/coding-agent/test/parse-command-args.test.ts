import { describe, expect, test } from "vitest";
import { parseCommandArgs } from "../src/utils/parse-command-args.js";

describe("parseCommandArgs utility", () => {
	test("parses plain whitespace-delimited arguments", () => {
		expect(parseCommandArgs("alpha beta gamma")).toEqual(["alpha", "beta", "gamma"]);
	});

	test("preserves quoted empty values", () => {
		expect(parseCommandArgs('"" " "')).toEqual(["", " "]);
	});

	test("handles escaped spaces in unquoted args", () => {
		expect(parseCommandArgs(String.raw`first\ arg second`)).toEqual(["first arg", "second"]);
	});

	test("handles escaped quotes in double-quoted args", () => {
		expect(parseCommandArgs('"quoted \\"value\\"" tail')).toEqual(['quoted "value"', "tail"]);
	});

	test("handles escaped backslashes in unquoted args", () => {
		expect(parseCommandArgs(String.raw`path\\to\\file other`)).toEqual([String.raw`path\to\file`, "other"]);
	});

	test("throws on unmatched quotes in strict mode", () => {
		expect(() => parseCommandArgs(`"unterminated`, { strict: true })).toThrow(/Unmatched quote/);
	});

	test("preserves legacy non-strict behavior for unmatched quotes", () => {
		expect(parseCommandArgs(`"unterminated`)).toEqual(["unterminated"]);
	});
});
