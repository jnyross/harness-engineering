import { readFileSync } from "node:fs";

const TYPES = ["feat", "fix", "docs", "refactor", "test", "chore", "perf", "ci", "build", "revert"];
const SCOPES = ["ai", "agent", "coding-agent", "tui", "mom", "pods", "web-ui", "repo"];

const commitMsgFile = process.argv[2];
if (!commitMsgFile) {
	console.error("Usage: lint-commit-msg.ts <commit-msg-file>");
	process.exit(1);
}

const msg = readFileSync(commitMsgFile, "utf-8").trim();
const firstLine = msg.split("\n")[0];

// Allow merge commits
if (firstLine.startsWith("Merge ")) process.exit(0);

const pattern = new RegExp(`^(${TYPES.join("|")})(\\((${SCOPES.join("|")})\\))?!?: .{1,100}$`);

if (!pattern.test(firstLine)) {
	console.error("Invalid commit message format.");
	console.error(`Expected: type(scope): description (scope is optional)`);
	console.error(`Types: ${TYPES.join(", ")}`);
	console.error(`Scopes: ${SCOPES.join(", ")}`);
	process.exit(1);
}
