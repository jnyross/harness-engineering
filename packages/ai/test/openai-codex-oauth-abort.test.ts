import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	loginOpenAICodex,
	openaiCodexOAuthProvider,
	refreshOpenAICodexToken,
} from "../src/utils/oauth/openai-codex.js";

function toBase64Url(input: string): string {
	return Buffer.from(input, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createAccessToken(accountId: string): string {
	const header = toBase64Url(JSON.stringify({ alg: "none", typ: "JWT" }));
	const payload = toBase64Url(
		JSON.stringify({
			"https://api.openai.com/auth": {
				chatgpt_account_id: accountId,
				extra: "a+/b",
			},
		}),
	);
	return `${header}.${payload}.signature`;
}

describe("openai-codex oauth login", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("rejects immediately when login signal is pre-aborted", async () => {
		const controller = new AbortController();
		const onAuth = vi.fn();
		const onPrompt = vi.fn(async () => "code");
		controller.abort();

		await expect(
			loginOpenAICodex({
				onAuth,
				onPrompt,
				signal: controller.signal,
			}),
		).rejects.toThrow("Login cancelled");
		expect(onAuth).not.toHaveBeenCalled();
		expect(onPrompt).not.toHaveBeenCalled();
	});

	it("forwards callback signal through provider login", async () => {
		const controller = new AbortController();
		const onAuth = vi.fn();
		controller.abort();

		await expect(
			openaiCodexOAuthProvider.login({
				onAuth,
				onPrompt: async () => "",
				signal: controller.signal,
			}),
		).rejects.toThrow("Login cancelled");
		expect(onAuth).not.toHaveBeenCalled();
	});

	it("rejects manual input when state mismatches", async () => {
		const onPrompt = vi.fn(async () => "");
		const fetchMock = vi.fn(async () => new Response(""));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			loginOpenAICodex({
				onAuth: () => {},
				onPrompt,
				onManualCodeInput: async () => "manual-code#wrong-state",
			}),
		).rejects.toThrow("OAuth state mismatch");
		expect(fetchMock).not.toHaveBeenCalled();
		expect(onPrompt).not.toHaveBeenCalled();
	});

	it("accepts manual code input and returns parsed account id", async () => {
		const token = createAccessToken("acct_123");
		const onPrompt = vi.fn(async () => "");
		const fetchMock = vi.fn(
			async (_input: unknown, _init?: RequestInit) =>
				new Response(
					JSON.stringify({
						access_token: token,
						refresh_token: "refresh-token",
						expires_in: 3600,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		const credentials = await loginOpenAICodex({
			onAuth: () => {},
			onPrompt,
			onManualCodeInput: async () => "manual-code",
		});

		expect(credentials.accountId).toBe("acct_123");
		expect(credentials.access).toBe(token);
		expect(credentials.refresh).toBe("refresh-token");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(onPrompt).not.toHaveBeenCalled();
		const firstCall = fetchMock.mock.calls[0];
		expect(firstCall).toBeDefined();
		if (!firstCall) {
			throw new Error("Expected token exchange fetch call");
		}
		expect(String(firstCall[1]?.body)).toContain("manual-code");
	});

	it("extracts account id from base64url JWT payload segments", async () => {
		const token = createAccessToken("acct_base64url");
		const fetchMock = vi.fn(
			async (_input: unknown, _init?: RequestInit) =>
				new Response(
					JSON.stringify({
						access_token: token,
						refresh_token: "refresh-token",
						expires_in: 3600,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		const credentials = await loginOpenAICodex({
			onAuth: () => {},
			onPrompt: async () => "",
			onManualCodeInput: async () => "code-from-manual-input",
		});

		expect(credentials.accountId).toBe("acct_base64url");
	});

	it("treats non-object token exchange payload roots as failed exchanges", async () => {
		const fetchMock = vi.fn(
			async (_input: unknown, _init?: RequestInit) =>
				new Response("null", {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			loginOpenAICodex({
				onAuth: () => {},
				onPrompt: async () => "",
				onManualCodeInput: async () => "manual-code",
			}),
		).rejects.toThrow("Token exchange failed");
	});

	it("treats invalid token exchange JSON payloads as failed exchanges", async () => {
		const fetchMock = vi.fn(
			async (_input: unknown, _init?: RequestInit) =>
				new Response("{", {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			loginOpenAICodex({
				onAuth: () => {},
				onPrompt: async () => "",
				onManualCodeInput: async () => "manual-code",
			}),
		).rejects.toThrow("Token exchange failed");
	});

	it("treats non-object refresh payload roots as failed refreshes", async () => {
		const fetchMock = vi.fn(
			async (_input: unknown, _init?: RequestInit) =>
				new Response("42", {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(refreshOpenAICodexToken("refresh-token")).rejects.toThrow("Failed to refresh OpenAI Codex token");
	});

	it("treats invalid refresh JSON payloads as failed refreshes", async () => {
		const fetchMock = vi.fn(
			async (_input: unknown, _init?: RequestInit) =>
				new Response("{", {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(refreshOpenAICodexToken("refresh-token")).rejects.toThrow("Failed to refresh OpenAI Codex token");
	});

	it("parses manual redirect urls with hash-based code/state values", async () => {
		let authState: string | null = null;
		const token = createAccessToken("acct_hash_url");
		const fetchMock = vi.fn(
			async (_input: unknown, _init?: RequestInit) =>
				new Response(
					JSON.stringify({
						access_token: token,
						refresh_token: "refresh-token-hash-url",
						expires_in: 3600,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		const credentials = await loginOpenAICodex({
			onAuth: ({ url }) => {
				authState = new URL(url).searchParams.get("state");
			},
			onPrompt: async () => "",
			onManualCodeInput: async () => `http://localhost:1455/auth/callback#code=hash-code&state=${authState}`,
		});

		expect(credentials.accountId).toBe("acct_hash_url");
		expect(credentials.refresh).toBe("refresh-token-hash-url");
		const firstCall = fetchMock.mock.calls[0];
		expect(firstCall).toBeDefined();
		if (!firstCall) {
			throw new Error("Expected token exchange fetch call");
		}
		expect(String(firstCall[1]?.body)).toContain("hash-code");
	});

	it("rejects when signal aborts after auth URL is emitted", async () => {
		const controller = new AbortController();
		const onPrompt = vi.fn(async () => "manual-code");

		await expect(
			loginOpenAICodex({
				onAuth: () => {
					controller.abort();
				},
				onPrompt,
				signal: controller.signal,
			}),
		).rejects.toThrow("Login cancelled");
		expect(onPrompt).not.toHaveBeenCalled();
	});

	it("falls back to manual input when callback port is unavailable", async () => {
		const busyServer = createServer((_req, res) => {
			res.statusCode = 200;
			res.end("busy");
		});
		await new Promise<void>((resolve) => {
			busyServer.listen(1455, "127.0.0.1", () => resolve());
		});

		let authState = "";
		const token = createAccessToken("acct_busy_port");
		const fetchMock = vi.fn(
			async (_input: unknown, _init?: RequestInit) =>
				new Response(
					JSON.stringify({
						access_token: token,
						refresh_token: "refresh-busy-port",
						expires_in: 3600,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		try {
			const credentials = await loginOpenAICodex({
				onAuth: ({ url }) => {
					authState = new URL(url).searchParams.get("state") ?? "";
				},
				onPrompt: async () => "",
				onManualCodeInput: async () => `http://localhost:1455/auth/callback?code=manual-code&state=${authState}`,
			});

			expect(credentials.accountId).toBe("acct_busy_port");
			expect(credentials.refresh).toBe("refresh-busy-port");
		} finally {
			await new Promise<void>((resolve) => {
				busyServer.close(() => resolve());
			});
		}
	});
});
