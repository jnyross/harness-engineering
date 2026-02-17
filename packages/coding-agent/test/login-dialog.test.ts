import type { TUI } from "@mariozechner/pi-tui";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { LoginDialogComponent } from "../src/modes/interactive/components/login-dialog.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";

function createDialog(onComplete = vi.fn()) {
	const fakeTui = { requestRender: vi.fn() } as unknown as TUI;
	const dialog = new LoginDialogComponent(fakeTui, "anthropic", onComplete);
	return { dialog, onComplete, fakeTui };
}

describe("LoginDialogComponent", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	it("calls onComplete only once when cancelled repeatedly", () => {
		const { dialog, onComplete } = createDialog();

		(dialog as unknown as { cancel: () => void }).cancel();
		(dialog as unknown as { cancel: () => void }).cancel();

		expect(onComplete).toHaveBeenCalledTimes(1);
		expect(onComplete).toHaveBeenCalledWith(false, "Login cancelled");
		expect(dialog.signal.aborted).toBe(true);
	});

	it("rejects previous pending prompt when a new prompt replaces it", async () => {
		const { dialog } = createDialog();

		const firstPrompt = dialog.showPrompt("Enter first code");
		const secondPrompt = dialog.showPrompt("Enter second code");

		await expect(firstPrompt).rejects.toThrow("Login prompt replaced before input was submitted");

		const resolver = (dialog as unknown as { inputResolver?: (value: string) => void }).inputResolver;
		expect(resolver).toBeDefined();
		resolver?.("second-code");

		await expect(secondPrompt).resolves.toBe("second-code");
	});
});
