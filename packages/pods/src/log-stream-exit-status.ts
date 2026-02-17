import { getSignalTerminationMessage } from "./child-exit-status.js";
import type { ProcessExitResult } from "./process-exit.js";

export function getLogStreamExitError(options: {
	processLabel: string;
	result: ProcessExitResult;
	interrupted: boolean;
}): string | undefined {
	if (options.interrupted) {
		return undefined;
	}

	if (options.result.error) {
		return `Failed to stream ${options.processLabel}: ${options.result.error.message}`;
	}

	if (options.result.code === 0) {
		return undefined;
	}

	const signalMessage = getSignalTerminationMessage(`${options.processLabel} process`, options.result.signal ?? null);
	if (signalMessage) {
		return signalMessage;
	}

	return `${options.processLabel} process exited with code ${options.result.code}`;
}
