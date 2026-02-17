import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeDrainInputDurations } from "../src/terminal.js";

describe("normalizeDrainInputDurations", () => {
	it("falls back to defaults for invalid non-positive durations", () => {
		assert.deepEqual(normalizeDrainInputDurations(undefined, undefined), { maxMs: 1000, idleMs: 50 });
		assert.deepEqual(normalizeDrainInputDurations(0, 0), { maxMs: 1000, idleMs: 50 });
		assert.deepEqual(normalizeDrainInputDurations(-1, -5), { maxMs: 1000, idleMs: 50 });
		assert.deepEqual(normalizeDrainInputDurations(Number.NaN, Number.NaN), { maxMs: 1000, idleMs: 50 });
	});

	it("preserves valid in-range durations", () => {
		assert.deepEqual(normalizeDrainInputDurations(500, 25), { maxMs: 500, idleMs: 25 });
	});

	it("clamps oversized durations to timer bounds and max drain window", () => {
		assert.deepEqual(normalizeDrainInputDurations(2_147_483_648, 2_147_483_649), {
			maxMs: 2_147_483_647,
			idleMs: 2_147_483_647,
		});
		assert.deepEqual(normalizeDrainInputDurations(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY), {
			maxMs: 2_147_483_647,
			idleMs: 2_147_483_647,
		});
		assert.deepEqual(normalizeDrainInputDurations(500, 1_000), { maxMs: 500, idleMs: 500 });
	});
});
