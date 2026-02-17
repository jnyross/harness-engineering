import { describe, expect, it } from "vitest";
import { sleep } from "../src/utils/sleep.js";

type AbortListener = ((event: unknown) => void) | { handleEvent: (event: unknown) => void };

describe("sleep", () => {
	it("resolves after delay", async () => {
		await expect(sleep(1)).resolves.toBeUndefined();
	});

	it("rejects immediately when signal is already aborted", async () => {
		const controller = new AbortController();
		controller.abort();
		await expect(sleep(10, controller.signal)).rejects.toThrow("Aborted");
	});

	it("cleans up abort listener after resolving", async () => {
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

		await sleep(1, signal);
		expect(listeners.size).toBe(0);
	});

	it("cleans up abort listener after rejection", async () => {
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

		const run = sleep(100, signal);
		for (const listener of listeners) {
			if (typeof listener === "function") {
				listener({ type: "abort" });
			} else {
				listener.handleEvent({ type: "abort" });
			}
		}

		await expect(run).rejects.toThrow("Aborted");
		expect(listeners.size).toBe(0);
	});
});
