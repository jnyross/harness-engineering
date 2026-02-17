import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { ChannelStore } from "../src/store.js";

function readLoggedMessage(tempDir: string, channelId: string): { date: string; ts: string } {
	const logPath = join(tempDir, channelId, "log.jsonl");
	const line = readFileSync(logPath, "utf-8").trim();
	return JSON.parse(line) as { date: string; ts: string };
}

describe("ChannelStore timestamp normalization", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("converts Slack decimal timestamps to ISO dates", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "mom-store-test-"));
		tempDirs.push(tempDir);
		const store = new ChannelStore({ workingDir: tempDir, botToken: "test-token" });

		await store.logMessage("C123", {
			date: "",
			ts: "1700000000.123456",
			user: "U1",
			text: "hello",
			attachments: [],
			isBot: false,
		});

		const logged = readLoggedMessage(tempDir, "C123");
		assert.equal(logged.ts, "1700000000.123456");
		assert.equal(logged.date, "2023-11-14T22:13:20.123Z");
	});

	it("falls back to current time for invalid timestamps instead of throwing", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "mom-store-test-"));
		tempDirs.push(tempDir);
		const store = new ChannelStore({ workingDir: tempDir, botToken: "test-token" });
		const before = Date.now();

		await store.logMessage("C456", {
			date: "",
			ts: "1700000000oops",
			user: "U2",
			text: "hello",
			attachments: [],
			isBot: false,
		});
		const after = Date.now();

		const logged = readLoggedMessage(tempDir, "C456");
		const loggedMs = Date.parse(logged.date);
		assert.equal(Number.isNaN(loggedMs), false);
		assert.ok(loggedMs >= before && loggedMs <= after);
	});

	it("converts integer-second timestamps to ISO dates", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "mom-store-test-"));
		tempDirs.push(tempDir);
		const store = new ChannelStore({ workingDir: tempDir, botToken: "test-token" });

		await store.logMessage("C789", {
			date: "",
			ts: "1700000000",
			user: "U3",
			text: "hello",
			attachments: [],
			isBot: false,
		});

		const logged = readLoggedMessage(tempDir, "C789");
		assert.equal(logged.date, "2023-11-14T22:13:20.000Z");
	});

	it("returns null for malformed last log lines without string timestamps", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "mom-store-test-"));
		tempDirs.push(tempDir);
		const channelId = "C999";
		const channelDir = join(tempDir, channelId);
		mkdirSync(channelDir, { recursive: true });
		const logPath = join(channelDir, "log.jsonl");

		writeFileSync(logPath, `${JSON.stringify({ ts: 12345, text: "invalid ts type" })}\n`, "utf-8");

		const store = new ChannelStore({ workingDir: tempDir, botToken: "test-token" });
		assert.equal(store.getLastTimestamp(channelId), null);
	});

	it("returns null for blank timestamp strings on last log line", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "mom-store-test-"));
		tempDirs.push(tempDir);
		const channelId = "C1000";
		const channelDir = join(tempDir, channelId);
		mkdirSync(channelDir, { recursive: true });
		const logPath = join(channelDir, "log.jsonl");

		writeFileSync(logPath, `${JSON.stringify({ ts: "   ", text: "blank ts" })}\n`, "utf-8");

		const store = new ChannelStore({ workingDir: tempDir, botToken: "test-token" });
		assert.equal(store.getLastTimestamp(channelId), null);
	});
});
