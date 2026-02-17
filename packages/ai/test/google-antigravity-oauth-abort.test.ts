import { describe, expect, it, vi } from "vitest";
import { antigravityOAuthProvider, loginAntigravity } from "../src/utils/oauth/google-antigravity.js";

describe("google-antigravity oauth abort handling", () => {
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
});
