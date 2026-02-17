import { createInterface } from "readline";

/**
 * Prompt for yes/no confirmation. Returns false when input closes before an answer.
 */
export async function promptConfirm(
	message: string,
	input: NodeJS.ReadableStream = process.stdin,
	output: NodeJS.WritableStream = process.stdout,
): Promise<boolean> {
	return new Promise((resolve) => {
		const rl = createInterface({ input, output });
		let settled = false;

		const cleanup = () => {
			rl.removeListener("close", onClose);
		};

		const resolveOnce = (value: boolean) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			resolve(value);
		};

		const onClose = () => {
			resolveOnce(false);
		};

		rl.on("close", onClose);
		rl.question(`${message} [y/N] `, (answer) => {
			const normalized = answer.trim().toLowerCase();
			resolveOnce(normalized === "y" || normalized === "yes");
			rl.close();
		});
	});
}
