import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseLoggedSlackTimestamp } from "../src/slack.js";

describe("parseLoggedSlackTimestamp", () => {
	it("returns normalized valid timestamps from log lines", () => {
		assert.equal(parseLoggedSlackTimestamp(JSON.stringify({ ts: "1700000000.123456" })), "1700000000.123456");
		assert.equal(parseLoggedSlackTimestamp(JSON.stringify({ ts: " 1700000000000 " })), "1700000000000");
	});

	it("returns undefined for malformed timestamp shapes", () => {
		assert.equal(parseLoggedSlackTimestamp("{"), undefined);
		assert.equal(parseLoggedSlackTimestamp("[]"), undefined);
		assert.equal(parseLoggedSlackTimestamp(JSON.stringify({ ts: "" })), undefined);
		assert.equal(parseLoggedSlackTimestamp(JSON.stringify({ ts: "invalid-ts" })), undefined);
		assert.equal(parseLoggedSlackTimestamp(JSON.stringify({ ts: 123 })), undefined);
	});
});
