import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMomEventContent, parseMomEventPayload } from "../src/events.js";

describe("parseMomEventPayload", () => {
	it("parses valid immediate/one-shot/periodic events", () => {
		assert.deepEqual(
			parseMomEventPayload({
				type: "immediate",
				channelId: "C123",
				text: "run now",
			}),
			{ type: "immediate", channelId: "C123", text: "run now" },
		);

		assert.deepEqual(
			parseMomEventPayload({
				type: "one-shot",
				channelId: "C123",
				text: "run later",
				at: "2026-02-16T12:00:00.000Z",
			}),
			{ type: "one-shot", channelId: "C123", text: "run later", at: "2026-02-16T12:00:00.000Z" },
		);

		assert.deepEqual(
			parseMomEventPayload({
				type: "periodic",
				channelId: "C123",
				text: "daily check",
				schedule: "0 9 * * *",
				timezone: "UTC",
			}),
			{
				type: "periodic",
				channelId: "C123",
				text: "daily check",
				schedule: "0 9 * * *",
				timezone: "UTC",
			},
		);
	});

	it("rejects malformed payload shapes", () => {
		assert.equal(parseMomEventPayload(null), undefined);
		assert.equal(parseMomEventPayload([]), undefined);
		assert.equal(
			parseMomEventPayload({
				type: "immediate",
				channelId: "",
				text: "ok",
			}),
			undefined,
		);
		assert.equal(
			parseMomEventPayload({
				type: "one-shot",
				channelId: "C123",
				text: "run later",
			}),
			undefined,
		);
		assert.equal(
			parseMomEventPayload({
				type: "periodic",
				channelId: "C123",
				text: "daily check",
				schedule: "0 9 * * *",
			}),
			undefined,
		);
		assert.equal(
			parseMomEventPayload({
				type: "unknown",
				channelId: "C123",
				text: "whatever",
			}),
			undefined,
		);
	});
});

describe("parseMomEventContent", () => {
	it("returns undefined for invalid JSON content", () => {
		assert.equal(parseMomEventContent("{"), undefined);
		assert.equal(parseMomEventContent("[]"), undefined);
	});
});
