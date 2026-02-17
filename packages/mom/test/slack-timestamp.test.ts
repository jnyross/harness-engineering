import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLatestSlackTimestamp, parseSlackTimestampToMilliseconds } from "../src/slack-timestamp.js";

describe("parseSlackTimestampToMilliseconds", () => {
	it("parses decimal Slack timestamps as milliseconds", () => {
		assert.equal(parseSlackTimestampToMilliseconds("1700000000.123456"), 1700000000123);
		assert.equal(parseSlackTimestampToMilliseconds(" 1700000000.999999 "), 1700000000999);
	});

	it("parses integer millisecond timestamps", () => {
		assert.equal(parseSlackTimestampToMilliseconds("1700000000123"), 1700000000123);
	});

	it("rejects malformed timestamp values", () => {
		assert.equal(parseSlackTimestampToMilliseconds("1700000000oops"), undefined);
		assert.equal(parseSlackTimestampToMilliseconds("-1"), undefined);
		assert.equal(parseSlackTimestampToMilliseconds(""), undefined);
	});
});

describe("getLatestSlackTimestamp", () => {
	it("returns the largest valid timestamp and ignores malformed entries", () => {
		const latest = getLatestSlackTimestamp([
			"1700000000.100000",
			"invalid-ts",
			"1700000000.300000",
			"1700000000.200000",
		]);
		assert.equal(latest, "1700000000.300000");
	});

	it("returns undefined when no timestamps are valid", () => {
		assert.equal(getLatestSlackTimestamp(["abc", "ts", "-1"]), undefined);
	});
});
