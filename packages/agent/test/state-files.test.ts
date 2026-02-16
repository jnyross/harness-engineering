import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { commitState, readState, writeState } from "../src/state-files.js";

const createdDirs: string[] = [];

function createGitRepo(): string {
	const dir = createTempDir("pi-agent-state-files-");
	execFileSync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: dir, encoding: "utf-8" });
	execFileSync("git", ["config", "user.name", "State Files Test"], { cwd: dir, encoding: "utf-8" });
	execFileSync("git", ["config", "user.email", "state-files-test@example.com"], { cwd: dir, encoding: "utf-8" });
	return dir;
}

function createTempDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	createdDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of createdDirs.splice(0, createdDirs.length)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("commitState", () => {
	it("commits state files with spaces in their paths", () => {
		const repoDir = createGitRepo();
		const relativePath = "state files/PROJECT STATUS.md";
		const absolutePath = join(repoDir, relativePath);
		mkdirSync(join(repoDir, "state files"), { recursive: true });
		writeFileSync(absolutePath, "status: green\n", "utf-8");

		commitState("state update", repoDir, [relativePath]);

		const lastCommitMessage = execFileSync("git", ["log", "-1", "--pretty=%s"], {
			cwd: repoDir,
			encoding: "utf-8",
		}).trim();
		expect(lastCommitMessage).toBe("state update");
	});

	it("does not throw when there is nothing to commit", () => {
		const repoDir = createGitRepo();
		const relativePath = "PROJECT_STATUS.md";
		writeFileSync(join(repoDir, relativePath), "initial\n", "utf-8");
		commitState("initial", repoDir, [relativePath]);
		expect(() => commitState("noop", repoDir, [relativePath])).not.toThrow();
	});

	it("stages and commits tracked file deletions", () => {
		const repoDir = createGitRepo();
		const relativePath = "state files/PROJECT STATUS.md";
		const absolutePath = join(repoDir, relativePath);
		mkdirSync(join(repoDir, "state files"), { recursive: true });
		writeFileSync(absolutePath, "status: green\n", "utf-8");
		commitState("initial", repoDir, [relativePath]);

		rmSync(absolutePath);
		commitState("remove state file", repoDir, [relativePath]);

		const statusOutput = execFileSync("git", ["show", "--name-status", "--pretty="], {
			cwd: repoDir,
			encoding: "utf-8",
		});
		expect(statusOutput).toContain(`D\t${relativePath}`);
	});
});

describe("writeState", () => {
	it("creates nested parent directories", () => {
		const dir = createTempDir("pi-agent-state-write-");
		const relativePath = "nested space/PROJECT_STATUS.md";
		writeState(relativePath, "ok\n", dir);
		expect(readState(relativePath, dir)).toBe("ok\n");
	});
});
