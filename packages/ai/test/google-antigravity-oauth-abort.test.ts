import { afterEach, describe, expect, it, vi } from "vitest";
import { antigravityOAuthProvider, loginAntigravity } from "../src/utils/oauth/google-antigravity.js";

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
});
