import { type Component, Container } from "@mariozechner/pi-tui";
import { describe, expect, it, vi } from "vitest";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.js";

describe("InteractiveMode container clearing", () => {
	it("disposes disposable children before clearing container", () => {
		const mode = Object.create(InteractiveMode.prototype) as {
			clearContainerWithDispose(container: Container): void;
		};
		const container = new Container();
		const disposeSpy = vi.fn();
		const disposableChild: Component & { dispose(): void } = {
			render: () => [],
			invalidate: () => {},
			dispose: disposeSpy,
		};
		const normalChild: Component = {
			render: () => [],
			invalidate: () => {},
		};

		container.addChild(disposableChild);
		container.addChild(normalChild);

		mode.clearContainerWithDispose(container);

		expect(disposeSpy).toHaveBeenCalledTimes(1);
		expect(container.children).toHaveLength(0);
	});

	it("disposes prior selector component during selector swaps", () => {
		let doneCallback: (() => void) | undefined;
		const oldDispose = vi.fn();
		const newDispose = vi.fn();
		const oldSelector: Component & { dispose(): void } = {
			render: () => [],
			invalidate: () => {},
			dispose: oldDispose,
		};
		const newSelector: Component & { dispose(): void } = {
			render: () => [],
			invalidate: () => {},
			dispose: newDispose,
		};
		const editor: Component = {
			render: () => [],
			invalidate: () => {},
		};
		const editorContainer = new Container();
		editorContainer.addChild(oldSelector);
		const ui = {
			setFocus: vi.fn(),
			requestRender: vi.fn(),
		};

		const mode = Object.create(InteractiveMode.prototype) as {
			editorContainer: Container;
			editor: Component;
			ui: { setFocus: (component: Component) => void; requestRender: () => void };
			showSelector(create: (done: () => void) => { component: Component; focus: Component }): void;
		};
		mode.editorContainer = editorContainer;
		mode.editor = editor;
		mode.ui = ui;

		mode.showSelector((done) => {
			doneCallback = done;
			return { component: newSelector, focus: newSelector };
		});

		expect(oldDispose).toHaveBeenCalledTimes(1);
		expect(editorContainer.children).toEqual([newSelector]);
		expect(ui.setFocus).toHaveBeenCalledWith(newSelector);

		doneCallback?.();
		expect(newDispose).toHaveBeenCalledTimes(1);
		expect(editorContainer.children).toEqual([editor]);
		expect(ui.setFocus).toHaveBeenCalledWith(editor);
	});
});
