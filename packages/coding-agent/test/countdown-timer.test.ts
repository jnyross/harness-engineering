import { afterEach, describe, expect, it, vi } from "vitest";
import { CountdownTimer } from "../src/modes/interactive/components/countdown-timer.js";

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
