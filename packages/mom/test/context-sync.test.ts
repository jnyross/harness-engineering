import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import type { UserMessage } from "@mariozechner/pi-ai";
import type { SessionManager } from "@mariozechner/pi-coding-agent";
import { syncLogToSessionManager } from "../src/context.js";

class FakeSessionManager {
	public appendedMessages: UserMessage[] = [];

	getEntries(): [] {
		return [];
	}

	appendMessage(message: UserMessage): void {
		this.appendedMessages.push(message);
	}
}

describe("syncLogToSessionManager", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			rmrf(dir);
		}
	});

	it("preserves zero epoch timestamps instead of replacing with current time", () => {
		const channelDir = createChannelDir(tempDirs, "C123");
		writeLogLines(channelDir, [
			{
				ts: "1.000000",
				date: "1970-01-01T00:00:00.000Z",
				userName: "alice",
				text: "hello",
				isBot: false,
			},
		]);

		const fake = new FakeSessionManager();
		const synced = syncLogToSessionManager(fake as unknown as SessionManager, channelDir);

		assert.equal(synced, 1);
		assert.equal(fake.appendedMessages.length, 1);
		assert.equal(fake.appendedMessages[0]?.timestamp, 0);
		assert.deepEqual(fake.appendedMessages[0]?.content, [{ type: "text", text: "[alice]: hello" }]);
	});

	it("skips malformed timestamp shapes and falls back to now for malformed dates", () => {
		const channelDir = createChannelDir(tempDirs, "C456");
		const before = Date.now();
		writeLogLines(channelDir, [
			{
				ts: 123,
				date: "2025-01-01T00:00:00.000Z",
				userName: "invalid-ts-type",
				text: "skip me",
				isBot: false,
			},
			{
				ts: "2.000000",
				date: "not-a-date",
				user: "bob",
				text: 99,
				isBot: false,
			},
		]);

		const fake = new FakeSessionManager();
		const synced = syncLogToSessionManager(fake as unknown as SessionManager, channelDir);
		const after = Date.now();

		assert.equal(synced, 1);
		assert.equal(fake.appendedMessages.length, 1);
		assert.deepEqual(fake.appendedMessages[0]?.content, [{ type: "text", text: "[bob]: " }]);
		const timestamp = fake.appendedMessages[0]?.timestamp;
		assert.equal(typeof timestamp, "number");
		assert.ok((timestamp ?? 0) >= before && (timestamp ?? 0) <= after);
	});

	it("skips whitespace-padded timestamp strings during sync", () => {
		const channelDir = createChannelDir(tempDirs, "C789");
		writeLogLines(channelDir, [
			{
				ts: " 3.000000 ",
				date: "2025-01-01T00:00:00.000Z",
				userName: "alice",
				text: "skip me",
				isBot: false,
			},
		]);

		const fake = new FakeSessionManager();
		const synced = syncLogToSessionManager(fake as unknown as SessionManager, channelDir);

		assert.equal(synced, 0);
		assert.equal(fake.appendedMessages.length, 0);
	});
});

function createChannelDir(tempDirs: string[], channelId: string): string {
	const tempDir = mkdtempSync(join(tmpdir(), "mom-context-sync-test-"));
	tempDirs.push(tempDir);
	const channelDir = join(tempDir, channelId);
	mkdirSync(channelDir, { recursive: true });
	return channelDir;
}

function writeLogLines(channelDir: string, lines: unknown[]): void {
	const logPath = join(channelDir, "log.jsonl");
	writeFileSync(logPath, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`, "utf-8");
}

function rmrf(path: string): void {
	try {
		rmSync(path, { recursive: true, force: true });
	} catch {
		// best-effort cleanup in tests
	}
}
