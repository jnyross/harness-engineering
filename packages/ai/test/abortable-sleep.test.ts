import { describe, expect, it } from "vitest";
import { abortableSleep } from "../src/utils/abortable-sleep.js";

type AbortListener = ((event: unknown) => void) | { handleEvent: (event: unknown) => void };

describe("abortableSleep", () => {
	it("resolves after the delay", async () => {
		await expect(abortableSleep(1)).resolves.toBeUndefined();
	});

	it("rejects immediately when signal is pre-aborted", async () => {
		const controller = new AbortController();
		controller.abort();
		await expect(abortableSleep(5, controller.signal)).rejects.toThrow("Request was aborted");
	});

	it("cleans up listeners after resolve", async () => {
		const listeners = new Set<AbortListener>();
		const signal = {
			aborted: false,
			addEventListener: (_type: string, listener: AbortListener) => {
				listeners.add(listener);
			},
			removeEventListener: (_type: string, listener: AbortListener) => {
				listeners.delete(listener);
			},
		} as unknown as AbortSignal;

		await abortableSleep(1, signal);
		expect(listeners.size).toBe(0);
	});

	it("cleans up listeners after abort", async () => {
		const listeners = new Set<AbortListener>();
		const signal = {
			aborted: false,
			addEventListener: (_type: string, listener: AbortListener) => {
				listeners.add(listener);
			},
			removeEventListener: (_type: string, listener: AbortListener) => {
				listeners.delete(listener);
			},
		} as unknown as AbortSignal;

		const run = abortableSleep(50, signal);
		for (const listener of listeners) {
			if (typeof listener === "function") {
				listener({ type: "abort" });
			} else {
				listener.handleEvent({ type: "abort" });
			}
		}

		await expect(run).rejects.toThrow("Request was aborted");
		expect(listeners.size).toBe(0);
	});
});
