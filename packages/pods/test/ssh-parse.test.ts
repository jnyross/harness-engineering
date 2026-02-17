import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
	extractHostFromSshCommand,
	getScpExitError,
	getSshStreamExitError,
	parseShellCommand,
	parseSshCommand,
	scpFile,
	sshExec,
	sshExecStream,
	sshExecStreamDetailed,
} from "../src/ssh.js";

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

	it("preserves windows-style backslashes in command paths", () => {
		assert.deepEqual(parseShellCommand(String.raw`C:\Windows\System32\OpenSSH\ssh.exe -p 22 ubuntu@demo.host`), [
			String.raw`C:\Windows\System32\OpenSSH\ssh.exe`,
			"-p",
			"22",
			"ubuntu@demo.host",
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
		assert.equal(extractHostFromSshCommand("ssh -p2222 ubuntu@demo.host"), "demo.host");
		assert.equal(extractHostFromSshCommand("/usr/bin/ssh -p 22 ubuntu@demo.host"), "demo.host");
		assert.equal(
			extractHostFromSshCommand("C:/Windows/System32/OpenSSH/ssh.exe -p 22 ubuntu@demo.host"),
			"demo.host",
		);
		assert.equal(
			extractHostFromSshCommand(String.raw`C:\Windows\System32\OpenSSH\ssh.exe -p 22 ubuntu@demo.host`),
			"demo.host",
		);
		assert.equal(extractHostFromSshCommand("ssh -o StrictHostKeyChecking=no demo.host"), "demo.host");
	});

	it("returns undefined for non-ssh commands", () => {
		assert.equal(extractHostFromSshCommand("bash -lc 'echo hi'"), undefined);
	});
});

describe("parseSshCommand", () => {
	it("returns parsed ssh binary and args", () => {
		assert.deepEqual(parseSshCommand("ssh -p 2222 user@host"), {
			sshBinary: "ssh",
			sshArgs: ["-p", "2222", "user@host"],
		});
	});

	it("rejects non-ssh binaries", () => {
		assert.throws(() => parseSshCommand("bash -lc 'echo hi'"), /expected ssh binary/);
	});
});

describe("sshExec", () => {
	it("rejects non-ssh command binaries before spawning", async () => {
		const result = await sshExec("bash -lc 'echo hi'", "echo test");
		assert.equal(result.exitCode, 1);
		assert.match(result.stderr, /expected ssh binary/);
	});

	it("returns non-zero when ssh binary cannot be spawned", async () => {
		const result = await sshExec("/definitely/missing/ssh user@host", "echo test");
		assert.equal(result.exitCode, 1);
	});

	it("reports non-zero exit code when ssh process exits via signal", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-pods-ssh-signal-"));
		const sshPath = join(dir, "ssh");
		try {
			writeFileSync(sshPath, "#!/bin/sh\nkill -TERM $$\n", { mode: 0o755 });
			chmodSync(sshPath, 0o755);

			const result = await sshExec(`${sshPath} user@host`, "echo test");
			assert.equal(result.exitCode, 1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("sshExecStream", () => {
	it("reports non-zero exit code when ssh process exits via signal", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-pods-ssh-stream-signal-"));
		const sshPath = join(dir, "ssh");
		try {
			writeFileSync(sshPath, "#!/bin/sh\nkill -TERM $$\n", { mode: 0o755 });
			chmodSync(sshPath, 0o755);

			const exitCode = await sshExecStream(`${sshPath} user@host`, "echo test", { silent: true });
			assert.equal(exitCode, 1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns non-zero when ssh binary cannot be spawned", async () => {
		const exitCode = await sshExecStream("/definitely/missing/ssh user@host", "echo test", { silent: true });
		assert.equal(exitCode, 1);
	});
});

describe("sshExecStreamDetailed", () => {
	it("returns parse diagnostics when ssh command is invalid", async () => {
		const result = await sshExecStreamDetailed("bash -lc 'echo hi'", "echo test", { silent: true });
		assert.equal(result.exitCode, 1);
		assert.match(result.error ?? "", /expected ssh binary/);
	});

	it("returns signal diagnostics for signal-terminated ssh streams", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-pods-ssh-stream-detailed-signal-"));
		const sshPath = join(dir, "ssh");
		try {
			writeFileSync(sshPath, "#!/bin/sh\nkill -TERM $$\n", { mode: 0o755 });
			chmodSync(sshPath, 0o755);

			const result = await sshExecStreamDetailed(`${sshPath} user@host`, "echo test", { silent: true });
			assert.equal(result.exitCode, 1);
			assert.equal(result.error, "SSH process terminated by signal SIGTERM");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("getSshStreamExitError", () => {
	it("reports unknown null/null exits", () => {
		assert.equal(getSshStreamExitError(null, null), "SSH process exited with unknown status");
	});
});

describe("scpFile", () => {
	it("reports unknown null/null exits", () => {
		assert.equal(getScpExitError(null, null), "scp process exited with unknown status");
	});

	it("returns parse errors when ssh command is invalid", async () => {
		const result = await scpFile("bash -lc 'echo hi'", "/tmp/local.txt", "/tmp/remote.txt");
		assert.equal(result.ok, false);
		assert.match(result.error ?? "", /expected ssh binary/);
	});

	it("forwards compatible ssh options and transforms -p to scp -P", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-pods-scp-args-"));
		const scpPath = join(dir, "scp");
		const argsPath = join(dir, "scp-args.txt");
		const originalPath = process.env.PATH;
		try {
			writeFileSync(
				scpPath,
				`#!/bin/sh
printf '%s\n' "$@" > "${argsPath}"
exit 0
`,
				{ mode: 0o755 },
			);
			chmodSync(scpPath, 0o755);
			process.env.PATH = `${dir}:${originalPath ?? ""}`;

			const result = await scpFile(
				`ssh -i "${join(dir, "id_rsa")}" -o StrictHostKeyChecking=no -p 2222 user@demo.host`,
				"/tmp/local.txt",
				"/tmp/remote.txt",
			);
			assert.equal(result.ok, true);

			const capturedArgs = readFileSync(argsPath, "utf8").trim().split("\n");
			assert.deepEqual(capturedArgs, [
				"-i",
				join(dir, "id_rsa"),
				"-o",
				"StrictHostKeyChecking=no",
				"-P",
				"2222",
				"/tmp/local.txt",
				"user@demo.host:/tmp/remote.txt",
			]);
		} finally {
			process.env.PATH = originalPath;
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("reports unsupported ssh options for scp forwarding", async () => {
		const result = await scpFile("ssh -W target:22 jump@host", "/tmp/local.txt", "/tmp/remote.txt");
		assert.equal(result.ok, false);
		assert.equal(result.error, "Unsupported SSH option for SCP: -W");
	});

	it("returns failure result when scp process exits via signal", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-pods-scp-signal-"));
		const scpPath = join(dir, "scp");
		const originalPath = process.env.PATH;
		try {
			writeFileSync(scpPath, "#!/bin/sh\nkill -TERM $$\n", { mode: 0o755 });
			chmodSync(scpPath, 0o755);
			process.env.PATH = `${dir}:${originalPath ?? ""}`;

			const result = await scpFile("ssh user@host", "/tmp/local.txt", "/tmp/remote.txt");
			assert.equal(result.ok, false);
			assert.equal(result.error, "scp process terminated by signal SIGTERM");
		} finally {
			process.env.PATH = originalPath;
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
