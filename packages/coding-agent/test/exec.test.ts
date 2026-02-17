import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { execCommand, getExecCommandCloseError } from "../src/core/exec.js";

const signalAwareIt = process.platform === "win32" ? it.skip : it;

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function waitForCondition(condition: () => boolean, timeoutMs: number): Promise<boolean> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (condition()) {
			return true;
		}
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	return condition();
}

describe("execCommand", () => {
	it("captures stdout/stderr and success exit code", async () => {
		const result = await execCommand(
			process.execPath,
			["-e", "process.stdout.write('out'); process.stderr.write('err');"],
			process.cwd(),
		);

		expect(result).toEqual({
			stdout: "out",
			stderr: "err",
			code: 0,
			killed: false,
		});
	});

	it("returns spawn error details for missing binaries", async () => {
		const result = await execCommand("definitely-missing-binary", [], process.cwd(), {
			cwd: process.cwd(),
		});

		expect(result.code).toBe(1);
		expect(result.killed).toBe(false);
		expect(result.stderr).toContain("Failed to start command 'definitely-missing-binary'");
	});

	it("adds fallback stderr diagnostics for non-zero exits without stderr output", async () => {
		const result = await execCommand(process.execPath, ["-e", "process.exit(17);"], process.cwd());

		expect(result.code).toBe(17);
		expect(result.killed).toBe(false);
		expect(result.stderr).toContain(`Command '${process.execPath} -e process.exit(17);' exited with code 17`);
	});

	it("short-circuits pre-aborted signals before spawning", async () => {
		const markerFile = join(tmpdir(), `pi-exec-preabort-${Date.now()}.txt`);
		if (existsSync(markerFile)) {
			rmSync(markerFile);
		}

		const controller = new AbortController();
		controller.abort();

		const result = await execCommand(
			process.execPath,
			["-e", `require("fs").writeFileSync(${JSON.stringify(markerFile)}, "created")`],
			process.cwd(),
			{ signal: controller.signal },
		);

		expect(result).toEqual({
			stdout: "",
			stderr: "Command aborted",
			code: 1,
			killed: true,
		});
		expect(existsSync(markerFile)).toBe(false);
	});

	it("marks timed out processes as killed", async () => {
		const result = await execCommand(process.execPath, ["-e", "setTimeout(() => {}, 5000);"], process.cwd(), {
			timeout: 20,
		});

		expect(result.killed).toBe(true);
		expect(result.code).toBe(1);
	});

	it("ignores oversized timeout values beyond Node timer range", async () => {
		const result = await execCommand(
			process.execPath,
			["-e", "setTimeout(() => process.exit(0), 25);"],
			process.cwd(),
			{
				timeout: Number.MAX_SAFE_INTEGER,
			},
		);

		expect(result.killed).toBe(false);
		expect(result.code).toBe(0);
	});

	it("treats signal-terminated subprocess exits as failures", async () => {
		const result = await execCommand(
			process.execPath,
			["-e", "setTimeout(() => process.kill(process.pid, 'SIGTERM'), 1);"],
			process.cwd(),
		);

		expect(result.killed).toBe(false);
		expect(result.code).toBe(1);
		expect(result.stderr).toContain("terminated by signal SIGTERM");
	});

	signalAwareIt("force kills timeout-resistant processes that ignore SIGTERM", async () => {
		const pidFile = join(tmpdir(), `pi-exec-timeout-pid-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
		let childPid: number | undefined;

		try {
			const resultPromise = execCommand(
				process.execPath,
				[
					"-e",
					`const fs = require('node:fs'); fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);`,
				],
				process.cwd(),
				{
					timeout: 25,
					forceKillDelayMs: 50,
				},
			);

			const pidReady = await waitForCondition(() => existsSync(pidFile), 1000);
			expect(pidReady).toBe(true);

			childPid = Number.parseInt(readFileSync(pidFile, "utf-8"), 10);
			expect(Number.isFinite(childPid)).toBe(true);

			const result = await resultPromise;
			expect(result.killed).toBe(true);
			expect(result.code).toBe(1);

			const exited = await waitForCondition(() => !isProcessAlive(childPid!), 1000);
			expect(exited).toBe(true);
		} finally {
			if (childPid && isProcessAlive(childPid)) {
				try {
					process.kill(childPid, "SIGKILL");
				} catch {
					// best-effort cleanup for test process
				}
			}
			if (existsSync(pidFile)) {
				writeFileSync(pidFile, "");
				rmSync(pidFile, { force: true });
			}
		}
	});
});

describe("getExecCommandCloseError", () => {
	it("returns undefined for successful exits", () => {
		expect(getExecCommandCloseError({ command: "echo", args: ["ok"], code: 0, signal: null })).toBeUndefined();
	});

	it("classifies unknown null/null close statuses", () => {
		expect(getExecCommandCloseError({ command: "echo", args: ["ok"], code: null, signal: null })).toBe(
			"Command 'echo ok' exited with unknown status",
		);
	});
});
