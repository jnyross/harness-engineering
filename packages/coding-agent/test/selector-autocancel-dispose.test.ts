import { beforeAll, describe, expect, it, vi } from "vitest";
import type { SessionTreeNode } from "../src/core/session-manager.js";
import { TreeSelectorComponent } from "../src/modes/interactive/components/tree-selector.js";
import { UserMessageSelectorComponent } from "../src/modes/interactive/components/user-message-selector.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";

describe("selector auto-cancel disposal", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	it("tree selector auto-cancel is suppressed after dispose", () => {
		vi.useFakeTimers();
		try {
			const onCancel = vi.fn();
			const selector = new TreeSelectorComponent([] as SessionTreeNode[], null, 24, () => {}, onCancel);

			selector.dispose();
			vi.advanceTimersByTime(200);

			expect(onCancel).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it("user message selector auto-cancel is suppressed after dispose", () => {
		vi.useFakeTimers();
		try {
			const onCancel = vi.fn();
			const selector = new UserMessageSelectorComponent([], () => {}, onCancel);

			selector.dispose();
			vi.advanceTimersByTime(200);

			expect(onCancel).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});
});
