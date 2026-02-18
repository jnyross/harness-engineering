import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	geminiCliOAuthProvider,
	loginGeminiCli,
	refreshGoogleCloudToken,
} from "../src/utils/oauth/google-gemini-cli.js";

describe("google-gemini-cli oauth login", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("rejects immediately when login signal is pre-aborted", async () => {
		const controller = new AbortController();
		const onAuth = vi.fn();
		controller.abort();

		await expect(loginGeminiCli(onAuth, undefined, undefined, controller.signal)).rejects.toThrow("Login cancelled");
		expect(onAuth).not.toHaveBeenCalled();
	});

	it("forwards callback signal through provider login", async () => {
		const controller = new AbortController();
		const onAuth = vi.fn();
		controller.abort();

		await expect(
			geminiCliOAuthProvider.login({
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
			loginGeminiCli(
				() => {},
				undefined,
				async () => "http://localhost:8085/oauth2callback#code=manual-code&state=wrong-state",
			),
		).rejects.toThrow("OAuth state mismatch");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects non-url manual input to preserve redirect-url contract", async () => {
		const fetchMock = vi.fn(async () => new Response(""));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			loginGeminiCli(
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
			busyServer.listen(8085, "127.0.0.1", () => resolve());
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
				return new Response(
					JSON.stringify({
						currentTier: { id: "free-tier" },
						cloudaicompanionProject: "gemini-project",
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}
			throw new Error(`Unexpected fetch URL: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		let authState = "";
		try {
			const credentials = await loginGeminiCli(
				(info) => {
					authState = new URL(info.url).searchParams.get("state") ?? "";
				},
				undefined,
				async () => `http://localhost:8085/oauth2callback?code=manual-code&state=${authState}`,
			);

			expect(credentials.refresh).toBe("refresh-token");
			expect(credentials.access).toBe("access-token");
			expect(credentials.projectId).toBe("gemini-project");
			expect(credentials.email).toBe("user@example.com");
		} finally {
			await new Promise<void>((resolve) => {
				busyServer.close(() => resolve());
			});
		}
	});

	it("ignores whitespace-padded user email values from profile lookup", async () => {
		let authState = "";
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
				return new Response(JSON.stringify({ email: " user@example.com " }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			if (url.includes("/v1internal:loadCodeAssist")) {
				return new Response(
					JSON.stringify({
						currentTier: { id: "free-tier" },
						cloudaicompanionProject: "gemini-project",
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}
			throw new Error(`Unexpected fetch URL: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		const credentials = await loginGeminiCli(
			(info) => {
				authState = new URL(info.url).searchParams.get("state") ?? "";
			},
			undefined,
			async () => `http://localhost:8085/oauth2callback?code=manual-code&state=${authState}`,
		);

		expect(credentials.projectId).toBe("gemini-project");
		expect(credentials.email).toBeUndefined();
	});

	it("rejects whitespace-padded discovered project identifiers", async () => {
		let authState = "";
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
				return new Response(
					JSON.stringify({
						currentTier: { id: "free-tier" },
						cloudaicompanionProject: " gemini-project ",
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}
			throw new Error(`Unexpected fetch URL: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			loginGeminiCli(
				(info) => {
					authState = new URL(info.url).searchParams.get("state") ?? "";
				},
				undefined,
				async () => `http://localhost:8085/oauth2callback?code=manual-code&state=${authState}`,
			),
		).rejects.toThrow("requires setting the GOOGLE_CLOUD_PROJECT");
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
			loginGeminiCli(
				(info) => {
					authState = new URL(info.url).searchParams.get("state") ?? "";
				},
				undefined,
				async () => `http://localhost:8085/oauth2callback?code=manual-code&state=${authState}`,
			),
		).rejects.toThrow("Google Cloud token exchange payload missing required fields");
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
			loginGeminiCli(
				(info) => {
					authState = new URL(info.url).searchParams.get("state") ?? "";
				},
				undefined,
				async () => `http://localhost:8085/oauth2callback?code=manual-code&state=${authState}`,
			),
		).rejects.toThrow("Google Cloud token exchange payload missing required fields");
	});

	it("rejects fractional expires_in token exchange payload fields", async () => {
		let authState = "";
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown) => {
				const url = String(input);
				if (url === "https://oauth2.googleapis.com/token") {
					return new Response(
						JSON.stringify({
							access_token: "access-token",
							refresh_token: "refresh-token",
							expires_in: 3600.5,
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
			loginGeminiCli(
				(info) => {
					authState = new URL(info.url).searchParams.get("state") ?? "";
				},
				undefined,
				async () => `http://localhost:8085/oauth2callback?code=manual-code&state=${authState}`,
			),
		).rejects.toThrow("Google Cloud token exchange payload missing required fields");
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

		await expect(refreshGoogleCloudToken("refresh-token", "project-123")).rejects.toThrow(
			"Google Cloud token refresh payload missing required fields",
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

		await expect(refreshGoogleCloudToken("refresh-token", "project-123")).rejects.toThrow(
			"Google Cloud token refresh payload missing required fields",
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

		const credentials = await refreshGoogleCloudToken("refresh-token", "project-123");
		expect(credentials.access).toBe("access-token");
		expect(credentials.refresh).toBe("refresh-token");
	});

	it("rejects fractional expires_in token refresh payload fields", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							access_token: "access-token",
							refresh_token: "refresh-token",
							expires_in: 3600.5,
						}),
						{
							status: 200,
							headers: { "content-type": "application/json" },
						},
					),
			),
		);

		await expect(refreshGoogleCloudToken("refresh-token", "project-123")).rejects.toThrow(
			"Google Cloud token refresh payload missing required fields",
		);
	});
});
