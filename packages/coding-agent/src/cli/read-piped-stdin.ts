/**
 * Read all content from piped stdin.
 * Returns undefined when stdin is a TTY.
 */
export async function readPipedStdin(input: NodeJS.ReadStream = process.stdin): Promise<string | undefined> {
	if (input.isTTY) {
		return undefined;
	}
	const streamState = input as NodeJS.ReadStream & { destroyed?: boolean; readableEnded?: boolean };
	if (streamState.destroyed || streamState.readableEnded) {
		return undefined;
	}

	return new Promise((resolve, reject) => {
		let data = "";
		let settled = false;

		const cleanup = () => {
			input.removeListener("data", onData);
			input.removeListener("end", onEnd);
			input.removeListener("error", onError);
			input.removeListener("close", onClose);
		};

		const resolveOnce = (value: string | undefined) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			resolve(value);
		};

		const rejectOnce = (error: Error) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			reject(error);
		};

		const onData = (chunk: string | Buffer) => {
			data += chunk.toString();
		};

		const onEnd = () => {
			resolveOnce(data.trim() || undefined);
		};

		const onError = (error: Error) => {
			rejectOnce(new Error(`Failed to read piped stdin: ${error.message}`));
		};

		const onClose = () => {
			resolveOnce(data.trim() || undefined);
		};

		input.setEncoding("utf8");
		input.on("data", onData);
		input.on("end", onEnd);
		input.on("error", onError);
		input.on("close", onClose);
		input.resume();
	});
}
