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
});
