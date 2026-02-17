import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { spawnScript } from "../src/sub-agent.js";

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

describe("spawnScript", () => {
	it("returns stdout, stderr, and exit code on success", async () => {
		const result = await spawnScript(process.execPath, [
			"-e",
			"process.stdout.write('out'); process.stderr.write('err');",
		]);

		expect(result).toEqual({
			stdout: "out",
			stderr: "err",
			exitCode: 0,
		});
	});

	it("rejects immediately when signal is already aborted", async () => {
		const controller = new AbortController();
		controller.abort();

		await expect(
			spawnScript(process.execPath, ["-e", "setTimeout(() => {}, 5000);"], { signal: controller.signal }),
		).rejects.toMatchObject({ name: "AbortError" });
	});

	it("rejects with AbortError when aborted during execution", async () => {
		const controller = new AbortController();
		const run = spawnScript(process.execPath, ["-e", "setTimeout(() => {}, 5000);"], { signal: controller.signal });

		setTimeout(() => controller.abort(), 25);

		await expect(run).rejects.toMatchObject({ name: "AbortError" });
	});

	signalAwareIt("force kills abort-resistant child processes", async () => {
		const pidFile = join(tmpdir(), `spawn-script-pid-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
		const controller = new AbortController();
		let childPid: number | undefined;
		const run = spawnScript(
			process.execPath,
			[
				"-e",
				`const fs = require('node:fs'); fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);`,
			],
			{ signal: controller.signal },
		);

		try {
			const pidWritten = await waitForCondition(() => existsSync(pidFile), 1000);
			expect(pidWritten).toBe(true);

			const pid = Number.parseInt(readFileSync(pidFile, "utf-8"), 10);
			expect(Number.isFinite(pid)).toBe(true);
			childPid = pid;

			controller.abort();
			await expect(run).rejects.toMatchObject({ name: "AbortError" });

			const exited = await waitForCondition(() => !isProcessAlive(pid), 2500);
			expect(exited).toBe(true);
		} finally {
			if (childPid && isProcessAlive(childPid)) {
				try {
					process.kill(childPid, "SIGKILL");
				} catch {
					// ignore best-effort cleanup
				}
			}
			rmSync(pidFile, { force: true });
		}
	});

	it("rejects with timeout error when timeout is exceeded", async () => {
		await expect(
			spawnScript(process.execPath, ["-e", "setTimeout(() => {}, 5000);"], { timeoutMs: 25 }),
		).rejects.toThrow(`Script '${process.execPath} -e setTimeout(() => {}, 5000);' timed out after 25ms`);
	});

	it("wraps spawn errors with command context", async () => {
		await expect(spawnScript("/definitely-not-a-real-binary", ["--version"])).rejects.toThrow(
			/Failed to start script '\/definitely-not-a-real-binary --version':/,
		);
	});

	signalAwareIt("returns non-zero exit code when child exits by signal", async () => {
		const result = await spawnScript(process.execPath, [
			"-e",
			"setTimeout(() => process.kill(process.pid, 'SIGTERM'), 10); setTimeout(() => {}, 2000);",
		]);

		expect(result.exitCode).toBe(1);
	});
});
