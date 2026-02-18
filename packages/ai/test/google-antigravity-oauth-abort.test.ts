import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	antigravityOAuthProvider,
	loginAntigravity,
	refreshAntigravityToken,
} from "../src/utils/oauth/google-antigravity.js";

describe("google-antigravity oauth login", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("rejects immediately when login signal is pre-aborted", async () => {
		const controller = new AbortController();
		const onAuth = vi.fn();
		controller.abort();

		await expect(loginAntigravity(onAuth, undefined, undefined, controller.signal)).rejects.toThrow(
			"Login cancelled",
		);
		expect(onAuth).not.toHaveBeenCalled();
	});

	it("forwards callback signal through provider login", async () => {
		const controller = new AbortController();
		const onAuth = vi.fn();
		controller.abort();

		await expect(
			antigravityOAuthProvider.login({
				onAuth,
				onPrompt: async () => "",
				signal: controller.signal,
			}),
		).rejects.toThrow("Login cancelled");
		expect(onAuth).not.toHaveBeenCalled();
	});

	it("rejects hash-fragment manual redirect input with mismatched state", async () => {
		const fetchMock = vi.fn(async () => new Response(""));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			loginAntigravity(
				() => {},
				undefined,
				async () => "http://localhost:51121/oauth-callback#code=manual-code&state=wrong-state",
			),
		).rejects.toThrow("OAuth state mismatch");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects non-url manual input to preserve redirect-url contract", async () => {
		const fetchMock = vi.fn(async () => new Response(""));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			loginAntigravity(
				() => {},
				undefined,
				async () => "manual-code#state",
			),
		).rejects.toThrow("Manual input must be a full redirect URL");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("falls back to manual input when callback port is unavailable", async () => {
		const busyServer = createServer((_req, res) => {
			res.statusCode = 200;
			res.end("busy");
		});
		await new Promise<void>((resolve) => {
			busyServer.listen(51121, "127.0.0.1", () => resolve());
		});

		const fetchMock = vi.fn(async (input: unknown) => {
			const url = String(input);
			if (url === "https://oauth2.googleapis.com/token") {
				return new Response(
					JSON.stringify({
						access_token: "access-token",
						refresh_token: "refresh-token",
						expires_in: 3600,
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}
			if (url === "https://www.googleapis.com/oauth2/v1/userinfo?alt=json") {
				return new Response(JSON.stringify({ email: "user@example.com" }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			if (url.includes("/v1internal:loadCodeAssist")) {
				return new Response(JSON.stringify({ cloudaicompanionProject: "project-from-api" }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			throw new Error(`Unexpected fetch URL: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		let authState = "";
		try {
			const credentials = await loginAntigravity(
				(info) => {
					authState = new URL(info.url).searchParams.get("state") ?? "";
				},
				undefined,
				async () => `http://localhost:51121/oauth-callback?code=manual-code&state=${authState}`,
			);

			expect(credentials.refresh).toBe("refresh-token");
			expect(credentials.access).toBe("access-token");
			expect(credentials.projectId).toBe("project-from-api");
		} finally {
			await new Promise<void>((resolve) => {
				busyServer.close(() => resolve());
			});
		}
	});

	it("rejects malformed token exchange payload roots", async () => {
		let authState = "";
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown) => {
				const url = String(input);
				if (url === "https://oauth2.googleapis.com/token") {
					return new Response("null", {
						status: 200,
						headers: { "content-type": "application/json" },
					});
				}
				throw new Error(`Unexpected fetch URL: ${url}`);
			}),
		);

		await expect(
			loginAntigravity(
				(info) => {
					authState = new URL(info.url).searchParams.get("state") ?? "";
				},
				undefined,
				async () => `http://localhost:51121/oauth-callback?code=manual-code&state=${authState}`,
			),
		).rejects.toThrow("Antigravity token exchange payload missing required fields");
	});

	it("rejects whitespace-padded token exchange payload fields", async () => {
		let authState = "";
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown) => {
				const url = String(input);
				if (url === "https://oauth2.googleapis.com/token") {
					return new Response(
						JSON.stringify({
							access_token: " access-token ",
							refresh_token: "refresh-token",
							expires_in: 3600,
						}),
						{
							status: 200,
							headers: { "content-type": "application/json" },
						},
					);
				}
				throw new Error(`Unexpected fetch URL: ${url}`);
			}),
		);

		await expect(
			loginAntigravity(
				(info) => {
					authState = new URL(info.url).searchParams.get("state") ?? "";
				},
				undefined,
				async () => `http://localhost:51121/oauth-callback?code=manual-code&state=${authState}`,
			),
		).rejects.toThrow("Antigravity token exchange payload missing required fields");
	});

	it("rejects malformed token refresh payload fields", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							access_token: "",
							expires_in: 0,
						}),
						{
							status: 200,
							headers: { "content-type": "application/json" },
						},
					),
			),
		);

		await expect(refreshAntigravityToken("refresh-token", "project-123")).rejects.toThrow(
			"Antigravity token refresh payload missing required fields",
		);
	});

	it("rejects whitespace-padded access token refresh payload fields", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							access_token: " access-token ",
							refresh_token: "refresh-token",
							expires_in: 3600,
						}),
						{
							status: 200,
							headers: { "content-type": "application/json" },
						},
					),
			),
		);

		await expect(refreshAntigravityToken("refresh-token", "project-123")).rejects.toThrow(
			"Antigravity token refresh payload missing required fields",
		);
	});

	it("keeps existing refresh token when payload refresh token is whitespace-padded", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							access_token: "access-token",
							refresh_token: " refreshed-token ",
							expires_in: 3600,
						}),
						{
							status: 200,
							headers: { "content-type": "application/json" },
						},
					),
			),
		);

		const credentials = await refreshAntigravityToken("refresh-token", "project-123");
		expect(credentials.access).toBe("access-token");
		expect(credentials.refresh).toBe("refresh-token");
	});
});
