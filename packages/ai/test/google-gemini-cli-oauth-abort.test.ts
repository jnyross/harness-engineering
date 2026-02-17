import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiCliOAuthProvider, loginGeminiCli } from "../src/utils/oauth/google-gemini-cli.js";

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
});
