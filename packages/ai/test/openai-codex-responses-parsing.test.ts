import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCodexEventPayload, streamOpenAICodexResponses } from "../src/providers/openai-codex-responses.js";
import type { Context, Model } from "../src/types.js";

const originalFetch = global.fetch;
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;

afterEach(() => {
	global.fetch = originalFetch;
	if (originalAgentDir === undefined) {
		delete process.env.PI_CODING_AGENT_DIR;
	} else {
		process.env.PI_CODING_AGENT_DIR = originalAgentDir;
	}
	vi.restoreAllMocks();
});

function createToken(accountId: string): string {
	const payload = Buffer.from(
		JSON.stringify({
			"https://api.openai.com/auth": { chatgpt_account_id: accountId },
		}),
		"utf8",
	).toString("base64");
	return `aaa.${payload}.bbb`;
}

describe("openai-codex responses parsing", () => {
	it("normalizes non-object Codex event payload roots", () => {
		expect(parseCodexEventPayload("not-json")).toBeUndefined();
		expect(parseCodexEventPayload("null")).toBeUndefined();
		expect(parseCodexEventPayload("42")).toBeUndefined();
		expect(parseCodexEventPayload('"event"')).toBeUndefined();
		expect(parseCodexEventPayload("[]")).toBeUndefined();
		expect(parseCodexEventPayload('{"type":"response.completed"}')).toEqual({ type: "response.completed" });
	});

	it("preserves friendly usage-limit errors for malformed error field shapes", async () => {
		process.env.PI_CODING_AGENT_DIR = mkdtempSync(join(tmpdir(), "pi-codex-parse-"));
		const token = createToken("acc_test");

		const fetchMock = vi.fn(async (input: string | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url === "https://api.github.com/repos/openai/codex/releases/latest") {
				return new Response(JSON.stringify({ tag_name: "rust-v0.0.0" }), { status: 200 });
			}
			if (url.startsWith("https://raw.githubusercontent.com/openai/codex/")) {
				return new Response("PROMPT", { status: 200, headers: { etag: '"etag"' } });
			}
			if (url === "https://chatgpt.com/backend-api/codex/responses") {
				return new Response(
					JSON.stringify({
						error: {
							code: "usage_limit_reached",
							message: { detail: "non-string message shape" },
							plan_type: ["pro"],
							resets_at: "soon",
						},
					}),
					{ status: 400, headers: { "content-type": "application/json" } },
				);
			}
			return new Response("not found", { status: 404 });
		});
		global.fetch = fetchMock as typeof fetch;

		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};

		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
		};

		const result = await streamOpenAICodexResponses(model, context, { apiKey: token }).result();
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toContain("You have hit your ChatGPT usage limit");
	});

	it("ignores whitespace-padded usage-limit error identifiers in codex error payloads", async () => {
		process.env.PI_CODING_AGENT_DIR = mkdtempSync(join(tmpdir(), "pi-codex-parse-"));
		const token = createToken("acc_test");

		const fetchMock = vi.fn(async (input: string | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url === "https://api.github.com/repos/openai/codex/releases/latest") {
				return new Response(JSON.stringify({ tag_name: "rust-v0.0.0" }), { status: 200 });
			}
			if (url.startsWith("https://raw.githubusercontent.com/openai/codex/")) {
				return new Response("PROMPT", { status: 200, headers: { etag: '"etag"' } });
			}
			if (url === "https://chatgpt.com/backend-api/codex/responses") {
				return new Response(
					JSON.stringify({
						error: {
							code: " usage_limit_reached ",
							message: { detail: "non-string message shape" },
							plan_type: " pro ",
							resets_at: "soon",
						},
					}),
					{ status: 400, headers: { "content-type": "application/json" } },
				);
			}
			return new Response("not found", { status: 404 });
		});
		global.fetch = fetchMock as typeof fetch;

		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};

		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
		};

		const result = await streamOpenAICodexResponses(model, context, { apiKey: token }).result();
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).not.toContain("You have hit your ChatGPT usage limit");
		expect(result.errorMessage).toContain("usage_limit_reached");
	});

	it("ignores whitespace-padded codex baseUrl values and falls back to default endpoint", async () => {
		process.env.PI_CODING_AGENT_DIR = mkdtempSync(join(tmpdir(), "pi-codex-parse-"));
		const token = createToken("acc_test");

		const fetchMock = vi.fn(async (input: string | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url === "https://api.github.com/repos/openai/codex/releases/latest") {
				return new Response(JSON.stringify({ tag_name: "rust-v0.0.0" }), { status: 200 });
			}
			if (url.startsWith("https://raw.githubusercontent.com/openai/codex/")) {
				return new Response("PROMPT", { status: 200, headers: { etag: '"etag"' } });
			}
			if (url === "https://chatgpt.com/backend-api/codex/responses") {
				return new Response(
					JSON.stringify({
						error: {
							message: "default endpoint used",
						},
					}),
					{ status: 400, headers: { "content-type": "application/json" } },
				);
			}
			return new Response(`unexpected url: ${url}`, { status: 500 });
		});
		global.fetch = fetchMock as typeof fetch;

		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: " https://example.invalid/backend-api ",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};

		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
		};

		const result = await streamOpenAICodexResponses(model, context, { apiKey: token }).result();
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toContain("default endpoint used");
		expect(
			fetchMock.mock.calls.some(([requestInput]) =>
				String(typeof requestInput === "string" ? requestInput : requestInput.toString()).includes(
					"example.invalid",
				),
			),
		).toBe(false);
	});
});
