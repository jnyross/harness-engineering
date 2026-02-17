/**
 * Sleep helper that rejects when the signal aborts.
 * Ensures abort listeners are always cleaned up.
 */
const MAX_TIMEOUT_MS = 2_147_483_647;

function normalizeSleepDurationMs(ms: number): number {
	return ms > MAX_TIMEOUT_MS ? MAX_TIMEOUT_MS : ms;
}

export function abortableSleep(ms: number, signal?: AbortSignal, abortMessage = "Request was aborted"): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error(abortMessage));
			return;
		}

		let settled = false;
		const cleanup = () => {
			if (signal) {
				signal.removeEventListener("abort", onAbort);
			}
		};
		const resolveOnce = () => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			resolve();
		};
		const rejectOnce = (error: Error) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			reject(error);
		};

		const timeout = setTimeout(resolveOnce, normalizeSleepDurationMs(ms));
		const onAbort = () => {
			clearTimeout(timeout);
			rejectOnce(new Error(abortMessage));
		};

		if (signal) {
			signal.addEventListener("abort", onAbort, { once: true });
		}
	});
}
