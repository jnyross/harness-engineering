import type { ChildProcess } from "child_process";

export interface ProcessExitResult {
	code: number;
	error?: Error;
	signal?: NodeJS.Signals | null;
}

export function waitForProcessExit(process: ChildProcess): Promise<ProcessExitResult> {
	return new Promise((resolve) => {
		let settled = false;

		const cleanup = () => {
			process.removeListener("error", onError);
			process.removeListener("exit", onExit);
		};

		const resolveOnce = (result: ProcessExitResult) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			resolve(result);
		};

		const onError = (error: Error) => {
			resolveOnce({ code: 1, error });
		};

		const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
			resolveOnce({ code: code ?? (signal ? 1 : 0), signal });
		};

		process.on("error", onError);
		process.on("exit", onExit);
	});
}
