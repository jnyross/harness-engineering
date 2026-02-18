import { getModel, type Usage } from "@mariozechner/pi-ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { streamProxy } from "../src/proxy.js";

const emptyUsage: Usage = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

describe("streamProxy", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("processes final SSE data line without trailing newline", async () => {
		const doneEvent = {
			type: "done",
			reason: "stop",
			usage: emptyUsage,
		};

		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(`data: ${JSON.stringify(doneEvent)}`, {
						status: 200,
						headers: { "Content-Type": "text/event-stream" },
					}),
			),
		);

		const stream = streamProxy(
			getModel("openai", "gpt-4o-mini"),
			{ messages: [] },
			{ authToken: "token", proxyUrl: "https://proxy.example.com" },
		);

		const result = await Promise.race([
			stream.result(),
			new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("timed out")), 1000)),
		]);

		expect(result.stopReason).toBe("stop");
		expect(result.usage.totalTokens).toBe(0);
	});

	it("processes SSE data lines when the data prefix has no trailing space", async () => {
		const doneEvent = {
			type: "done",
			reason: "stop",
			usage: emptyUsage,
		};

		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(`data:${JSON.stringify(doneEvent)}`, {
						status: 200,
						headers: { "Content-Type": "text/event-stream" },
					}),
			),
		);

		const stream = streamProxy(
			getModel("openai", "gpt-4o-mini"),
			{ messages: [] },
			{ authToken: "token", proxyUrl: "https://proxy.example.com" },
		);

		const result = await Promise.race([
			stream.result(),
			new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("timed out")), 1000)),
		]);

		expect(result.stopReason).toBe("stop");
		expect(result.usage.totalTokens).toBe(0);
	});

	it("returns an error result when proxy response stream body is empty", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(null, {
						status: 200,
						headers: { "Content-Type": "text/event-stream" },
					}),
			),
		);

		const stream = streamProxy(
			getModel("openai", "gpt-4o-mini"),
			{ messages: [] },
			{ authToken: "token", proxyUrl: "https://proxy.example.com" },
		);

		const result = await Promise.race([
			stream.result(),
			new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("timed out")), 1000)),
		]);

		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toBe("Proxy error: response stream body is empty");
		expect(result.usage.totalTokens).toBe(0);
	});
});
