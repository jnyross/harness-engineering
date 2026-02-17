import { describe, expect, it, vi } from "vitest";
import { loginOpenAICodex, openaiCodexOAuthProvider } from "../src/utils/oauth/openai-codex.js";

describe("openai-codex oauth abort handling", () => {
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
});
