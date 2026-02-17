import { basename } from "path";

export function resolveAppCommand(argv1: string | undefined): string {
	const invokedCommand = argv1 ? basename(argv1) : undefined;
	return invokedCommand && invokedCommand !== "cli.ts" && invokedCommand !== "cli.js" ? invokedCommand : "pi";
}

export function extractPodOverride(
	cliArgs: string[],
	allowPodOverride: boolean,
): { podOverride?: string; argsWithoutPod: string[] } {
	const argsWithoutPod: string[] = [];
	let podOverride: string | undefined;

	for (let i = 0; i < cliArgs.length; i++) {
		const arg = cliArgs[i];

		if (arg === "--") {
			argsWithoutPod.push(...cliArgs.slice(i));
			break;
		}

		if (arg === "--pod") {
			if (!allowPodOverride) {
				throw new Error("Option --pod is only supported for model commands (start, stop, list, logs, agent).");
			}
			const podName = cliArgs[i + 1];
			if (!podName || podName.startsWith("-")) {
				throw new Error("Option --pod requires a pod name.");
			}
			if (podOverride) {
				throw new Error("Option --pod may only be provided once.");
			}
			podOverride = podName;
			i++;
			continue;
		}

		if (arg.startsWith("--pod=")) {
			if (!allowPodOverride) {
				throw new Error("Option --pod is only supported for model commands (start, stop, list, logs, agent).");
			}
			const podName = arg.slice("--pod=".length).trim();
			if (!podName || podName.startsWith("-")) {
				throw new Error("Option --pod requires a pod name.");
			}
			if (podOverride) {
				throw new Error("Option --pod may only be provided once.");
			}
			podOverride = podName;
			continue;
		}

		argsWithoutPod.push(arg);
	}

	return { podOverride, argsWithoutPod };
}
