import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractHostFromSshCommand, parseShellCommand } from "../src/ssh.js";

describe("parseShellCommand", () => {
	it("parses simple ssh commands", () => {
		assert.deepEqual(parseShellCommand("ssh root@1.2.3.4"), ["ssh", "root@1.2.3.4"]);
	});

	it("preserves quoted segments and escaped spaces", () => {
		assert.deepEqual(parseShellCommand(`ssh -i "~/.ssh/my key" user@host`), [
			"ssh",
			"-i",
			"~/.ssh/my key",
			"user@host",
		]);
		assert.deepEqual(parseShellCommand(String.raw`ssh -o ProxyCommand=nc\ -x\ proxy:1080\ %h\ %p user@host`), [
			"ssh",
			"-o",
			"ProxyCommand=nc -x proxy:1080 %h %p",
			"user@host",
		]);
	});

	it("rejects malformed commands with unmatched quote", () => {
		assert.throws(() => parseShellCommand(`ssh "user@host`), /unmatched quote/);
	});
});

describe("extractHostFromSshCommand", () => {
	it("extracts host for common ssh variants", () => {
		assert.equal(extractHostFromSshCommand("ssh root@1.2.3.4"), "1.2.3.4");
		assert.equal(extractHostFromSshCommand(`ssh -p 2222 -i "~/.ssh/key file" ubuntu@demo.host`), "demo.host");
		assert.equal(extractHostFromSshCommand("ssh -o StrictHostKeyChecking=no demo.host"), "demo.host");
	});
});
