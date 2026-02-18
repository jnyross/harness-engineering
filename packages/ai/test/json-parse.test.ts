import { describe, expect, it } from "vitest";
import { parseStreamingJson } from "../src/utils/json-parse.js";

describe("parseStreamingJson", () => {
	it("returns parsed object for complete JSON object payloads", () => {
		expect(parseStreamingJson('{"a":1,"b":"two"}')).toEqual({ a: 1, b: "two" });
	});

	it("returns parsed object for partial JSON object payloads", () => {
		expect(parseStreamingJson('{"a":1,"b":"two"')).toEqual({ a: 1, b: "two" });
	});

	it("normalizes primitive and array payloads to empty objects", () => {
		expect(parseStreamingJson("1")).toEqual({});
		expect(parseStreamingJson('"text"')).toEqual({});
		expect(parseStreamingJson("[1,2,3]")).toEqual({});
	});

	it("returns empty object when parsing fails", () => {
		expect(parseStreamingJson("{")).toEqual({});
		expect(parseStreamingJson(undefined)).toEqual({});
		expect(parseStreamingJson("")).toEqual({});
	});
});
