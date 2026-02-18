import { describe, expect, it } from "vitest";
import { parseRipgrepEventLine } from "../src/core/tools/grep.js";

describe("parseRipgrepEventLine", () => {
	it("returns undefined for invalid JSON or non-object payload roots", () => {
		expect(parseRipgrepEventLine("not-json")).toBeUndefined();
		expect(parseRipgrepEventLine("42")).toBeUndefined();
		expect(parseRipgrepEventLine('"match"')).toBeUndefined();
		expect(parseRipgrepEventLine("[]")).toBeUndefined();
		expect(parseRipgrepEventLine("{}")).toBeUndefined();
	});

	it("parses non-match event types without match metadata", () => {
		expect(parseRipgrepEventLine('{"type":"begin","data":{"path":{"text":"file.txt"}}}')).toEqual({
			type: "begin",
		});
	});

	it("parses valid match events with file path and line number", () => {
		expect(
			parseRipgrepEventLine(
				'{"type":"match","data":{"path":{"text":"src/index.ts"},"line_number":12,"lines":{"text":"match"}}}',
			),
		).toEqual({
			type: "match",
			filePath: "src/index.ts",
			lineNumber: 12,
		});
	});

	it("normalizes malformed match metadata to undefined fields", () => {
		expect(parseRipgrepEventLine('{"type":"match","data":{"path":{"text":1},"line_number":"12"}}')).toEqual({
			type: "match",
			filePath: undefined,
			lineNumber: undefined,
		});
		expect(parseRipgrepEventLine('{"type":"match","data":{"path":{"text":"src/index.ts"},"line_number":0}}')).toEqual(
			{
				type: "match",
				filePath: "src/index.ts",
				lineNumber: undefined,
			},
		);
	});
});
