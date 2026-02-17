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

	it("tree selector isolates callback exceptions", () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const tree: SessionTreeNode[] = [
			{
				entry: {
					type: "message",
					id: "m1",
					parentId: null,
					timestamp: new Date().toISOString(),
					message: { role: "user", content: "hello", timestamp: Date.now() },
				},
				children: [],
			},
		];
		const selector = new TreeSelectorComponent(
			tree,
			"m1",
			24,
			() => {
				throw new Error("select failed");
			},
			() => {},
		);

		expect(() => selector.handleInput("\r")).not.toThrow();
		expect(consoleError).toHaveBeenCalled();
	});

	it("user message selector isolates callback exceptions", () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const selector = new UserMessageSelectorComponent(
			[{ id: "u1", text: "hello" }],
			() => {
				throw new Error("select failed");
			},
			() => {},
		);

		expect(() => selector.getMessageList().handleInput("\r")).not.toThrow();
		expect(consoleError).toHaveBeenCalled();
	});
});
