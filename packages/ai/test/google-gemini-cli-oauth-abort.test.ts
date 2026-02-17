import { describe, expect, it, vi } from "vitest";
import { geminiCliOAuthProvider, loginGeminiCli } from "../src/utils/oauth/google-gemini-cli.js";

describe("google-gemini-cli oauth abort handling", () => {
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
});
