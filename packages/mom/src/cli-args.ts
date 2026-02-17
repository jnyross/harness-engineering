import { resolve } from "path";
import { parseSandboxArg, type SandboxConfig } from "./sandbox.js";

export interface ParsedArgs {
	workingDir?: string;
	sandbox: SandboxConfig;
	downloadChannel?: string;
}

function readRequiredOptionValue(args: string[], optionIndex: number, optionName: string): string {
	const value = args[optionIndex + 1];
	if (!value || value.startsWith("-")) {
		throw new Error(`Option ${optionName} requires a value.`);
	}
	return value;
}

export function parseCliArgs(args: string[]): ParsedArgs {
	let sandbox: SandboxConfig = { type: "host" };
	let workingDir: string | undefined;
	let downloadChannelId: string | undefined;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg.startsWith("--sandbox=")) {
			sandbox = parseSandboxArg(arg.slice("--sandbox=".length));
		} else if (arg === "--sandbox") {
			sandbox = parseSandboxArg(readRequiredOptionValue(args, i, "--sandbox"));
			i++;
		} else if (arg.startsWith("--download=")) {
			downloadChannelId = arg.slice("--download=".length);
		} else if (arg === "--download") {
			downloadChannelId = readRequiredOptionValue(args, i, "--download");
			i++;
		} else if (!arg.startsWith("-")) {
			workingDir = arg;
		}
	}

	return {
		workingDir: workingDir ? resolve(workingDir) : undefined,
		sandbox,
		downloadChannel: downloadChannelId,
	};
}
