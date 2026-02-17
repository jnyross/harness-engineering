import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeBash, executeBashWithOperations } from "../src/core/bash-executor.js";
import * as shellModule from "../src/utils/shell.js";

describe("bash executor cancellation behavior", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("short-circuits executeBash when signal is pre-aborted", async () => {
		const markerFile = join(tmpdir(), `pi-bash-executor-${Date.now()}.txt`);
		if (existsSync(markerFile)) {
			rmSync(markerFile);
		}

		const controller = new AbortController();
		controller.abort();

		const result = await executeBash(
			`${process.execPath} -e "require('fs').writeFileSync(${JSON.stringify(markerFile)}, 'created')"`,
			{
				signal: controller.signal,
			},
		);

		expect(result).toEqual({
			output: "",
			exitCode: undefined,
			cancelled: true,
			truncated: false,
		});
		expect(existsSync(markerFile)).toBe(false);
	});

	it("short-circuits executeBashWithOperations when signal is pre-aborted", async () => {
		const controller = new AbortController();
		controller.abort();
		let called = false;

		const result = await executeBashWithOperations(
			"echo should-not-run",
			process.cwd(),
			{
				exec: async () => {
					called = true;
					return { exitCode: 0 };
				},
			},
			{ signal: controller.signal },
		);

		expect(called).toBe(false);
		expect(result).toEqual({
			output: "",
			exitCode: undefined,
			cancelled: true,
			truncated: false,
		});
	});

	it("still executes operations when signal is active", async () => {
		const result = await executeBashWithOperations(
			"echo hi",
			process.cwd(),
			{
				exec: async (_command, _cwd, options) => {
					options.onData(Buffer.from("hello\n"));
					return { exitCode: 0 };
				},
			},
			{},
		);

		expect(result.cancelled).toBe(false);
		expect(result.exitCode).toBe(0);
		expect(result.output).toContain("hello");
	});

	it("treats signal-terminated local commands as non-cancelled failures", async () => {
		const result = await executeBash("kill -TERM $$");
		expect(result.cancelled).toBe(false);
		expect(result.exitCode).toBe(1);
	});

	it("maps null operation exit codes to non-zero when not cancelled", async () => {
		const result = await executeBashWithOperations(
			"echo hi",
			process.cwd(),
			{
				exec: async (_command, _cwd, options) => {
					options.onData(Buffer.from("terminated\n"));
					return { exitCode: null };
				},
			},
			{},
		);

		expect(result.cancelled).toBe(false);
		expect(result.exitCode).toBe(1);
		expect(result.output).toContain("terminated");
	});

	it("rejects when shell process fails to spawn", async () => {
		vi.spyOn(shellModule, "getShellConfig").mockReturnValue({
			shell: "/definitely/missing-shell-binary",
			args: ["-c"],
		});

		await expect(executeBash("echo test")).rejects.toThrow(
			/Failed to start shell command '\/definitely\/missing-shell-binary -c echo test'/,
		);
	});
});
