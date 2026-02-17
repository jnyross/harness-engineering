import { describe, expect, it, vi } from "vitest";
import { anthropicOAuthProvider, loginAnthropic } from "../src/utils/oauth/anthropic.js";

describe("anthropic oauth abort handling", () => {
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
});
