import { afterEach, describe, expect, it, vi } from "vitest";
import { CountdownTimer, normalizeCountdownTimeoutMs } from "../src/modes/interactive/components/countdown-timer.js";

describe("CountdownTimer", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("ticks down and expires once", () => {
		vi.useFakeTimers();
		const ticks: number[] = [];
		const onExpire = vi.fn();

		new CountdownTimer(2100, undefined, (seconds) => ticks.push(seconds), onExpire);

		vi.advanceTimersByTime(3000);

		expect(ticks).toEqual([3, 2, 1, 0]);
		expect(onExpire).toHaveBeenCalledTimes(1);
	});

	it("stops ticking after dispose", () => {
		vi.useFakeTimers();
		const ticks: number[] = [];
		const onExpire = vi.fn();

		const timer = new CountdownTimer(3000, undefined, (seconds) => ticks.push(seconds), onExpire);
		vi.advanceTimersByTime(1000);
		timer.dispose();
		vi.advanceTimersByTime(5000);

		expect(ticks).toEqual([3, 2]);
		expect(onExpire).not.toHaveBeenCalled();
	});

	it("disposes immediately when onTick throws", () => {
		vi.useFakeTimers();
		const onExpire = vi.fn();
		const onTick = vi.fn(() => {
			throw new Error("tick failed");
		});
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		new CountdownTimer(2000, undefined, onTick, onExpire);
		vi.advanceTimersByTime(5000);

		expect(onTick).toHaveBeenCalledTimes(1);
		expect(onExpire).not.toHaveBeenCalled();
		expect(consoleError).toHaveBeenCalled();
	});
});

describe("normalizeCountdownTimeoutMs", () => {
	it("returns undefined for missing or invalid non-positive timeout values", () => {
		expect(normalizeCountdownTimeoutMs(undefined)).toBeUndefined();
		expect(normalizeCountdownTimeoutMs(0)).toBeUndefined();
		expect(normalizeCountdownTimeoutMs(-1)).toBeUndefined();
		expect(normalizeCountdownTimeoutMs(Number.NaN)).toBeUndefined();
		expect(normalizeCountdownTimeoutMs(Number.POSITIVE_INFINITY)).toBeUndefined();
	});

	it("preserves valid timeout values within timer range", () => {
		expect(normalizeCountdownTimeoutMs(1)).toBe(1);
		expect(normalizeCountdownTimeoutMs(5_000)).toBe(5_000);
		expect(normalizeCountdownTimeoutMs(2_147_483_647)).toBe(2_147_483_647);
	});

	it("clamps oversized timeout values to Node timer max", () => {
		expect(normalizeCountdownTimeoutMs(2_147_483_648)).toBe(2_147_483_647);
		expect(normalizeCountdownTimeoutMs(Number.MAX_SAFE_INTEGER)).toBe(2_147_483_647);
	});
});
