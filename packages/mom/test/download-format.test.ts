import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMessage, formatTs } from "../src/download.js";

describe("formatTs", () => {
	it("formats valid Slack timestamps", () => {
		assert.equal(formatTs("1700000000.123456"), "2023-11-14 22:13:20");
	});

	it("returns raw timestamp for malformed values", () => {
		assert.equal(formatTs("1700000000oops"), "1700000000oops");
	});
});

describe("formatMessage", () => {
	it("formats single-line messages", () => {
		assert.equal(formatMessage("1700000000.123456", "user", "hello"), "[2023-11-14 22:13:20] user: hello");
	});

	it("keeps malformed timestamps visible in output", () => {
		assert.equal(formatMessage("bad-ts", "user", "hello"), "[bad-ts] user: hello");
	});
});
