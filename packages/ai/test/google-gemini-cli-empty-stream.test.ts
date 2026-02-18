import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCloudCodeAssistChunk, streamGoogleGeminiCli } from "../src/providers/google-gemini-cli.js";
import type { Context, Model } from "../src/types.js";

const originalFetch = global.fetch;

afterEach(() => {
	global.fetch = originalFetch;
	vi.restoreAllMocks();
});

describe("google-gemini-cli empty stream retry", () => {
	it("parses only object-shaped Cloud Code Assist chunks", () => {
		expect(parseCloudCodeAssistChunk("not-json")).toBeUndefined();
		expect(parseCloudCodeAssistChunk("null")).toBeUndefined();
		expect(parseCloudCodeAssistChunk("42")).toBeUndefined();
		expect(parseCloudCodeAssistChunk("[]")).toBeUndefined();
		expect(parseCloudCodeAssistChunk('{"response":{"modelVersion":"v1"}}')).toEqual({
			response: { modelVersion: "v1" },
		});
	});

	it("retries empty SSE responses without duplicate start", async () => {
		const emptyStream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.close();
			},
		});

		const sse = `${[
			`data: ${JSON.stringify({
				response: {
					candidates: [
						{
							content: { role: "model", parts: [{ text: "Hello" }] },
							finishReason: "STOP",
						},
					],
					usageMetadata: {
						promptTokenCount: 1,
						candidatesTokenCount: 1,
						totalTokenCount: 2,
					},
				},
			})}`,
		].join("\n\n")}\n\n`;

		const encoder = new TextEncoder();
		const dataStream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(sse));
				controller.close();
			},
		});

		let callCount = 0;
		const fetchMock = vi.fn(async () => {
			callCount += 1;
			if (callCount === 1) {
				return new Response(emptyStream, {
					status: 200,
					headers: { "content-type": "text/event-stream" },
				});
			}
			return new Response(dataStream, {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			});
		});

		global.fetch = fetchMock as typeof fetch;

		const model: Model<"google-gemini-cli"> = {
			id: "gemini-2.5-flash",
			name: "Gemini 2.5 Flash",
			api: "google-gemini-cli",
			provider: "google-gemini-cli",
			baseUrl: "https://cloudcode-pa.googleapis.com",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 8192,
		};

		const context: Context = {
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};

		const stream = streamGoogleGeminiCli(model, context, {
			apiKey: JSON.stringify({ token: "token", projectId: "project" }),
		});

		let startCount = 0;
		let doneCount = 0;
		let text = "";

		for await (const event of stream) {
			if (event.type === "start") {
				startCount += 1;
			}
			if (event.type === "done") {
				doneCount += 1;
			}
			if (event.type === "text_delta") {
				text += event.delta;
			}
		}

		const result = await stream.result();

		expect(text).toBe("Hello");
		expect(result.stopReason).toBe("stop");
		expect(startCount).toBe(1);
		expect(doneCount).toBe(1);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("processes terminal SSE line without trailing newline", async () => {
		const sseNoTrailingNewline = `data: ${JSON.stringify({
			response: {
				candidates: [
					{
						content: { role: "model", parts: [{ text: "Tail" }] },
						finishReason: "STOP",
					},
				],
				usageMetadata: {
					promptTokenCount: 1,
					candidatesTokenCount: 1,
					totalTokenCount: 2,
				},
			},
		})}`;

		const encoder = new TextEncoder();
		const dataStream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(sseNoTrailingNewline));
				controller.close();
			},
		});

		global.fetch = vi.fn(async () => {
			return new Response(dataStream, {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			});
		}) as typeof fetch;

		const model: Model<"google-gemini-cli"> = {
			id: "gemini-2.5-flash",
			name: "Gemini 2.5 Flash",
			api: "google-gemini-cli",
			provider: "google-gemini-cli",
			baseUrl: "https://cloudcode-pa.googleapis.com",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 8192,
		};

		const context: Context = {
			messages: [{ role: "user", content: "Say tail", timestamp: Date.now() }],
		};

		const stream = streamGoogleGeminiCli(model, context, {
			apiKey: JSON.stringify({ token: "token", projectId: "project" }),
		});

		let text = "";
		for await (const event of stream) {
			if (event.type === "text_delta") {
				text += event.delta;
			}
		}

		const result = await stream.result();
		expect(text).toBe("Tail");
		expect(result.stopReason).toBe("stop");
	});

	it("ignores malformed non-object SSE data roots before valid response chunks", async () => {
		const validChunk = {
			response: {
				candidates: [
					{
						content: { role: "model", parts: [{ text: "Recovered" }] },
						finishReason: "STOP",
					},
				],
				usageMetadata: {
					promptTokenCount: 1,
					candidatesTokenCount: 1,
					totalTokenCount: 2,
				},
			},
		};
		const sse = ["data: null", "", "data: 42", "", "data: []", "", `data: ${JSON.stringify(validChunk)}`].join("\n");

		const encoder = new TextEncoder();
		const dataStream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(sse));
				controller.close();
			},
		});

		global.fetch = vi.fn(async () => {
			return new Response(dataStream, {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			});
		}) as typeof fetch;

		const model: Model<"google-gemini-cli"> = {
			id: "gemini-2.5-flash",
			name: "Gemini 2.5 Flash",
			api: "google-gemini-cli",
			provider: "google-gemini-cli",
			baseUrl: "https://cloudcode-pa.googleapis.com",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 8192,
		};

		const context: Context = {
			messages: [{ role: "user", content: "recover after malformed", timestamp: Date.now() }],
		};

		const stream = streamGoogleGeminiCli(model, context, {
			apiKey: JSON.stringify({ token: "token", projectId: "project" }),
		});

		let text = "";
		for await (const event of stream) {
			if (event.type === "text_delta") {
				text += event.delta;
			}
		}

		const result = await stream.result();
		expect(text).toBe("Recovered");
		expect(result.stopReason).toBe("stop");
	});

	it("rejects malformed credential payload shapes before issuing requests", async () => {
		const fetchMock = vi.fn(async () => {
			throw new Error("should not be called");
		});
		global.fetch = fetchMock as typeof fetch;

		const model: Model<"google-gemini-cli"> = {
			id: "gemini-2.5-flash",
			name: "Gemini 2.5 Flash",
			api: "google-gemini-cli",
			provider: "google-gemini-cli",
			baseUrl: "https://cloudcode-pa.googleapis.com",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 8192,
		};

		const context: Context = {
			messages: [{ role: "user", content: "Say tail", timestamp: Date.now() }],
		};

		const stream = streamGoogleGeminiCli(model, context, {
			apiKey: JSON.stringify({ token: { bad: true }, projectId: [] }),
		});

		const result = await stream.result();
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toContain("Invalid Google Cloud Code Assist credentials");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects credential payloads with whitespace-padded token fields before issuing requests", async () => {
		const fetchMock = vi.fn(async () => {
			throw new Error("should not be called");
		});
		global.fetch = fetchMock as typeof fetch;

		const model: Model<"google-gemini-cli"> = {
			id: "gemini-2.5-flash",
			name: "Gemini 2.5 Flash",
			api: "google-gemini-cli",
			provider: "google-gemini-cli",
			baseUrl: "https://cloudcode-pa.googleapis.com",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 8192,
		};

		const context: Context = {
			messages: [{ role: "user", content: "Say tail", timestamp: Date.now() }],
		};

		const stream = streamGoogleGeminiCli(model, context, {
			apiKey: JSON.stringify({ token: " token ", projectId: "project-id" }),
		});

		const result = await stream.result();
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toContain("Invalid Google Cloud Code Assist credentials");
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
