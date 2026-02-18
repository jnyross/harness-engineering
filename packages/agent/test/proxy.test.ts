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

	it("returns a descriptive error result for malformed SSE JSON payloads", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response("data:{invalid-json}", {
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
		expect(result.errorMessage).toContain("Proxy error: invalid SSE event JSON");
		expect(result.errorMessage).toContain("invalid-json");
	});

	it("ignores malformed JSON root shapes and continues processing valid events", async () => {
		const doneEvent = {
			type: "done",
			reason: "stop",
			usage: emptyUsage,
		};

		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						[
							"data: null",
							"",
							"data: 42",
							"",
							'data: {"foo":"bar"}',
							"",
							`data: ${JSON.stringify(doneEvent)}`,
						].join("\n"),
						{
							status: 200,
							headers: { "Content-Type": "text/event-stream" },
						},
					),
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
		expect(result.errorMessage).toBeUndefined();
	});

	it("ignores malformed typed proxy events and continues processing valid done events", async () => {
		const doneEvent = {
			type: "done",
			reason: "stop",
			usage: emptyUsage,
		};
		const malformedUsageDoneEvent = {
			type: "done",
			reason: "stop",
			usage: {
				input: 1.2,
				output: 2,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 3,
				cost: { input: 0.1, output: 0.2, cacheRead: 0, cacheWrite: 0, total: 0.3 },
			},
		};

		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						[
							'data: {"type":"text_delta","contentIndex":"1","delta":42}',
							"",
							'data: {"type":"toolcall_start","contentIndex":0,"id":"","toolName":""}',
							"",
							`data: ${JSON.stringify(malformedUsageDoneEvent)}`,
							"",
							`data: ${JSON.stringify(doneEvent)}`,
						].join("\n"),
						{
							status: 200,
							headers: { "Content-Type": "text/event-stream" },
						},
					),
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
		expect(result.errorMessage).toBeUndefined();
	});

	it("accepts decimal usage costs while requiring integer token counters", async () => {
		const doneEvent = {
			type: "done",
			reason: "stop",
			usage: {
				input: 5,
				output: 3,
				cacheRead: 2,
				cacheWrite: 1,
				totalTokens: 11,
				cost: {
					input: 0.0125,
					output: 0.0235,
					cacheRead: 0.001,
					cacheWrite: 0,
					total: 0.037,
				},
			},
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
		expect(result.usage.input).toBe(5);
		expect(result.usage.output).toBe(3);
		expect(result.usage.cacheRead).toBe(2);
		expect(result.usage.cacheWrite).toBe(1);
		expect(result.usage.totalTokens).toBe(11);
		expect(result.usage.cost.total).toBe(0.037);
	});
});
