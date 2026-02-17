import { describe, expect, it } from "vitest";
import { spawnScript } from "../src/sub-agent.js";

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

	it("rejects with timeout error when timeout is exceeded", async () => {
		await expect(
			spawnScript(process.execPath, ["-e", "setTimeout(() => {}, 5000);"], { timeoutMs: 25 }),
		).rejects.toThrow("Script timed out after 25ms");
	});
});
