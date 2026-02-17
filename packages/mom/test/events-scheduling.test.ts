import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeOneShotDelayMs, parseOneShotTimestampMs } from "../src/events.js";

describe("one-shot event scheduling helpers", () => {
	it("parses valid one-shot timestamps", () => {
		const parsed = parseOneShotTimestampMs("2026-02-16T12:00:00.000Z");
		assert.equal(typeof parsed, "number");
		assert.equal(Number.isFinite(parsed), true);
	});

	it("rejects invalid one-shot timestamps", () => {
		assert.equal(parseOneShotTimestampMs("not-a-date"), undefined);
		assert.equal(parseOneShotTimestampMs("2026-99-99"), undefined);
	});

	it("normalizes one-shot delay values", () => {
		assert.deepEqual(normalizeOneShotDelayMs(1), { delayMs: 1, needsReschedule: false });
		assert.deepEqual(normalizeOneShotDelayMs(2_147_483_647), { delayMs: 2_147_483_647, needsReschedule: false });
		assert.deepEqual(normalizeOneShotDelayMs(2_147_483_648), { delayMs: 2_147_483_647, needsReschedule: true });
		assert.equal(normalizeOneShotDelayMs(0), undefined);
		assert.equal(normalizeOneShotDelayMs(-10), undefined);
		assert.equal(normalizeOneShotDelayMs(Number.NaN), undefined);
	});
});
