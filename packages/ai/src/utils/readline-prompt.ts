import type { Interface } from "readline";

/**
 * Prompts a readline interface and resolves with a fallback if it closes early.
 */
export function promptWithCloseFallback(rl: Interface, question: string, closeFallback = ""): Promise<string> {
	return new Promise((resolve) => {
		let settled = false;

		const cleanup = () => {
			rl.removeListener("close", onClose);
		};

		const resolveOnce = (value: string) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			resolve(value);
		};

		const onClose = () => {
			resolveOnce(closeFallback);
		};

		rl.on("close", onClose);
		rl.question(question, (answer) => {
			resolveOnce(answer);
		});
	});
}
