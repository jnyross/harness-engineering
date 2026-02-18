import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	getLatestSlackTimestamp,
	isSlackTimestampOlder,
	isValidSlackTimestamp,
	parseSlackTimestampToMilliseconds,
} from "../src/slack-timestamp.js";

describe("parseSlackTimestampToMilliseconds", () => {
	it("parses decimal Slack timestamps as milliseconds", () => {
		assert.equal(parseSlackTimestampToMilliseconds("1700000000.123456"), 1700000000123);
		assert.equal(parseSlackTimestampToMilliseconds(" 1700000000.999999 "), 1700000000999);
	});

	it("parses integer millisecond timestamps", () => {
		assert.equal(parseSlackTimestampToMilliseconds("1700000000123"), 1700000000123);
	});

	it("parses integer second timestamps", () => {
		assert.equal(parseSlackTimestampToMilliseconds("1700000000"), 1700000000000);
	});

	it("treats integer timestamps with leading zeros as seconds when magnitude indicates seconds", () => {
		assert.equal(parseSlackTimestampToMilliseconds("0001700000000"), 1700000000000);
	});

	it("rejects malformed timestamp values", () => {
		assert.equal(parseSlackTimestampToMilliseconds("1700000000oops"), undefined);
		assert.equal(parseSlackTimestampToMilliseconds("-1"), undefined);
		assert.equal(parseSlackTimestampToMilliseconds(""), undefined);
		assert.equal(parseSlackTimestampToMilliseconds("9007199254740.993"), undefined);
		assert.equal(parseSlackTimestampToMilliseconds("9007199254740993"), undefined);
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

	it("compares mixed integer-seconds and decimal-second timestamps correctly", () => {
		const latest = getLatestSlackTimestamp(["1700000000", "1700000000.200000", "1700000000.100000"]);
		assert.equal(latest, "1700000000.200000");
	});

	it("preserves microsecond ordering for timestamps within same millisecond", () => {
		const latest = getLatestSlackTimestamp(["1700000000.123456", "1700000000.123789"]);
		assert.equal(latest, "1700000000.123789");
	});

	it("ignores non-string runtime entries in timestamp iterables", () => {
		const latest = getLatestSlackTimestamp([
			"1700000000.200000",
			{ ts: "1700000000.500000" },
			"1700000000.300000",
		] as unknown as Iterable<string>);
		assert.equal(latest, "1700000000.300000");
	});
});

describe("isValidSlackTimestamp", () => {
	it("returns true for valid decimal/integer timestamp values", () => {
		assert.equal(isValidSlackTimestamp("1700000000.123456"), true);
		assert.equal(isValidSlackTimestamp("1700000000"), true);
	});

	it("returns false for missing or malformed values", () => {
		assert.equal(isValidSlackTimestamp(undefined), false);
		assert.equal(isValidSlackTimestamp("invalid"), false);
	});
});

describe("isSlackTimestampOlder", () => {
	it("compares valid timestamps across decimal and integer forms", () => {
		assert.equal(isSlackTimestampOlder("1700000000.100000", "1700000000.200000"), true);
		assert.equal(isSlackTimestampOlder("1700000000", "1700000000.100000"), true);
		assert.equal(isSlackTimestampOlder("1700000001000", "1700000000.500000"), false);
	});

	it("returns undefined when either timestamp is malformed", () => {
		assert.equal(isSlackTimestampOlder("invalid", "1700000000.100000"), undefined);
		assert.equal(isSlackTimestampOlder("1700000000.100000", "invalid"), undefined);
	});
});
