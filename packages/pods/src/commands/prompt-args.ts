import { randomBytes } from "crypto";

export const RESERVED_AGENT_FLAGS = ["--provider", "--model"];

export function findReservedFlag(userArgs: string[]): string | undefined {
	for (const arg of userArgs) {
		if (arg === "--") {
			break;
		}
		for (const flag of RESERVED_AGENT_FLAGS) {
			if (arg === flag || arg.startsWith(`${flag}=`)) {
				return flag;
			}
		}
	}
	return undefined;
}

export function createProviderName(prefix: string = "pods-vllm"): string {
	return `${prefix}-${randomBytes(4).toString("hex")}`;
}
