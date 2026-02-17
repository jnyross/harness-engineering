import type { SpawnSyncReturns } from "node:child_process";

export const GH_CLI_NOT_INSTALLED_MESSAGE = "GitHub CLI (gh) is not installed. Install it from https://cli.github.com/";
export const GH_CLI_NOT_LOGGED_IN_MESSAGE = "GitHub CLI is not logged in. Run 'gh auth login' first.";

export function getGhAuthStatusError(result: SpawnSyncReturns<string>): string | undefined {
	if (result.error) {
		const error = result.error as NodeJS.ErrnoException;
		if (error.code === "ENOENT") {
			return GH_CLI_NOT_INSTALLED_MESSAGE;
		}
		if (error.code === "ETIMEDOUT") {
			return "GitHub CLI auth check timed out. Try again.";
		}
		return `GitHub CLI auth check failed: ${error.message}`;
	}
	if (result.signal) {
		return `GitHub CLI auth check was interrupted (${result.signal}). Try again.`;
	}
	if (result.status === null) {
		return "GitHub CLI auth check exited with unknown status. Try again.";
	}
	if (result.status !== 0) {
		return GH_CLI_NOT_LOGGED_IN_MESSAGE;
	}
	return undefined;
}
