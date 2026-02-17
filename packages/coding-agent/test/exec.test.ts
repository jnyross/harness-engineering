import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { execCommand } from "../src/core/exec.js";

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
		expect(result.stderr.length).toBeGreaterThan(0);
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

	it("treats signal-terminated subprocess exits as failures", async () => {
		const result = await execCommand(
			process.execPath,
			["-e", "setTimeout(() => process.kill(process.pid, 'SIGTERM'), 1);"],
			process.cwd(),
		);

		expect(result.killed).toBe(false);
		expect(result.code).toBe(1);
	});
});
