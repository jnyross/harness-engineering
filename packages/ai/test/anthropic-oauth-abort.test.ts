import { afterEach, describe, expect, it, vi } from "vitest";
import { anthropicOAuthProvider, loginAnthropic } from "../src/utils/oauth/anthropic.js";

describe("anthropic oauth login", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("rejects immediately when login signal is pre-aborted", async () => {
		const controller = new AbortController();
		const onAuth = vi.fn();
		const onPrompt = vi.fn(async () => "code#state");
		controller.abort();

		await expect(loginAnthropic(onAuth, onPrompt, controller.signal)).rejects.toThrow("Login cancelled");
		expect(onAuth).not.toHaveBeenCalled();
		expect(onPrompt).not.toHaveBeenCalled();
	});

	it("forwards callback signal through provider login", async () => {
		const controller = new AbortController();
		const onAuth = vi.fn();
		controller.abort();

		await expect(
			anthropicOAuthProvider.login({
				onAuth: ({ url }) => onAuth(url),
				onPrompt: async () => "",
				signal: controller.signal,
			}),
		).rejects.toThrow("Login cancelled");
		expect(onAuth).not.toHaveBeenCalled();
	});

	it("rejects when pasted state does not match verifier", async () => {
		const onAuth = vi.fn();
		const fetchMock = vi.fn(async (_input: unknown, _init?: RequestInit) => new Response(""));
		vi.stubGlobal("fetch", fetchMock);

		await expect(loginAnthropic(onAuth, async () => "auth-code#wrong-state")).rejects.toThrow("OAuth state mismatch");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("parses full redirect urls and exchanges parsed code", async () => {
		let verifierState: string | null = null;
		const onAuth = (url: string) => {
			verifierState = new URL(url).searchParams.get("state");
		};

		const fetchMock = vi.fn(
			async (_input: unknown, _init?: RequestInit) =>
				new Response(
					JSON.stringify({
						access_token: "access-token",
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

		const credentials = await loginAnthropic(
			onAuth,
			async () => `https://console.anthropic.com/oauth/code/callback?code=parsed-code&state=${verifierState}`,
		);

		expect(credentials.access).toBe("access-token");
		expect(credentials.refresh).toBe("refresh-token");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const firstCall = fetchMock.mock.calls[0];
		expect(firstCall).toBeDefined();
		if (!firstCall) {
			throw new Error("Expected fetch to be called once");
		}
		const requestInit = firstCall[1];
		expect(requestInit).toMatchObject({
			method: "POST",
			headers: { "Content-Type": "application/json" },
		});
		expect(String(requestInit?.body)).toContain('"code":"parsed-code"');
	});

	it("parses query-string formatted manual input", async () => {
		let verifierState: string | null = null;
		const onAuth = (url: string) => {
			verifierState = new URL(url).searchParams.get("state");
		};

		const fetchMock = vi.fn(
			async (_input: unknown, _init?: RequestInit) =>
				new Response(
					JSON.stringify({
						access_token: "access-token-2",
						refresh_token: "refresh-token-2",
						expires_in: 3600,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		const credentials = await loginAnthropic(onAuth, async () => `code=query-code&state=${verifierState}`);

		expect(credentials.access).toBe("access-token-2");
		expect(credentials.refresh).toBe("refresh-token-2");
		const firstCall = fetchMock.mock.calls[0];
		expect(firstCall).toBeDefined();
		if (!firstCall) {
			throw new Error("Expected fetch to be called once");
		}
		expect(String(firstCall[1]?.body)).toContain('"code":"query-code"');
	});

	it("parses redirect urls with hash-based code/state values", async () => {
		let verifierState: string | null = null;
		const onAuth = (url: string) => {
			verifierState = new URL(url).searchParams.get("state");
		};

		const fetchMock = vi.fn(
			async (_input: unknown, _init?: RequestInit) =>
				new Response(
					JSON.stringify({
						access_token: "access-token-hash",
						refresh_token: "refresh-token-hash",
						expires_in: 3600,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		const credentials = await loginAnthropic(
			onAuth,
			async () => `https://console.anthropic.com/oauth/code/callback#code=hash-code&state=${verifierState}`,
		);

		expect(credentials.access).toBe("access-token-hash");
		expect(credentials.refresh).toBe("refresh-token-hash");
		const firstCall = fetchMock.mock.calls[0];
		expect(firstCall).toBeDefined();
		if (!firstCall) {
			throw new Error("Expected fetch to be called once");
		}
		expect(String(firstCall[1]?.body)).toContain('"code":"hash-code"');
	});
});
