import { beforeAll, describe, expect, it, vi } from "vitest";
import { ExtensionEditorComponent } from "../src/modes/interactive/components/extension-editor.js";
import { ExtensionInputComponent } from "../src/modes/interactive/components/extension-input.js";
import { ExtensionSelectorComponent } from "../src/modes/interactive/components/extension-selector.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";

describe("extension dialog callback safety", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	it("extension selector isolates onSelect callback exceptions", () => {
		const onCancel = vi.fn();
		const onSelect = vi.fn(() => {
			throw new Error("select failed");
		});
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const selector = new ExtensionSelectorComponent("Choose", ["one"], onSelect, onCancel);

		expect(() => selector.handleInput("\n")).not.toThrow();
		expect(onSelect).toHaveBeenCalledWith("one");
		expect(consoleError).toHaveBeenCalled();
	});

	it("extension input isolates onSubmit callback exceptions", () => {
		const onCancel = vi.fn();
		const onSubmit = vi.fn(() => {
			throw new Error("submit failed");
		});
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const input = new ExtensionInputComponent("Input", undefined, onSubmit, onCancel);

		expect(() => input.handleInput("\n")).not.toThrow();
		expect(onSubmit).toHaveBeenCalledWith("");
		expect(consoleError).toHaveBeenCalled();
	});

	it("extension editor isolates submit/cancel callback exceptions", () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const component = Object.create(ExtensionEditorComponent.prototype) as {
			invokeSubmit(value: string): void;
			invokeCancel(): void;
			dispose(): void;
			onSubmitCallback: (value: string) => void;
			onCancelCallback: () => void;
			disposed: boolean;
		};
		component.disposed = false;
		component.onSubmitCallback = () => {
			throw new Error("editor submit failed");
		};
		component.onCancelCallback = () => {
			throw new Error("editor cancel failed");
		};

		expect(() => component.invokeSubmit("value")).not.toThrow();
		expect(() => component.invokeCancel()).not.toThrow();
		expect(consoleError).toHaveBeenCalledTimes(2);
	});

	it("extension editor ignores callbacks after dispose", () => {
		const onSubmit = vi.fn();
		const onCancel = vi.fn();
		const component = Object.create(ExtensionEditorComponent.prototype) as {
			invokeSubmit(value: string): void;
			invokeCancel(): void;
			dispose(): void;
			onSubmitCallback: (value: string) => void;
			onCancelCallback: () => void;
			disposed: boolean;
		};
		component.disposed = false;
		component.onSubmitCallback = onSubmit;
		component.onCancelCallback = onCancel;

		component.dispose();
		component.invokeSubmit("value");
		component.invokeCancel();

		expect(onSubmit).not.toHaveBeenCalled();
		expect(onCancel).not.toHaveBeenCalled();
	});
});
