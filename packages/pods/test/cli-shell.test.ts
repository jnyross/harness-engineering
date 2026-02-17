import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, "..", "src", "cli.ts");

describe("pi shell", () => {
	it("reports SSH spawn startup failures cleanly", () => {
		const configDir = mkdtempSync(join(tmpdir(), "pi-pods-shell-test-"));
		try {
			writeFileSync(
				join(configDir, "pods.json"),
				JSON.stringify(
					{
						active: "demo",
						pods: {
							demo: {
								ssh: "/definitely/missing/ssh user@host",
								gpus: [],
								models: {},
							},
						},
					},
					null,
					2,
				),
			);

			const result = spawnSync("npx", ["tsx", CLI_PATH, "shell"], {
				env: { ...process.env, PI_CONFIG_DIR: configDir },
				encoding: "utf-8",
			});

			const combinedOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
			assert.equal(result.status, 1);
			assert.match(combinedOutput, /Failed to start SSH process/);
		} finally {
			rmSync(configDir, { recursive: true, force: true });
		}
	});

	it("exits non-zero when SSH process terminates by signal", () => {
		const configDir = mkdtempSync(join(tmpdir(), "pi-pods-shell-signal-"));
		const scriptDir = mkdtempSync(join(tmpdir(), "pi-pods-shell-script-"));
		const sshPath = join(scriptDir, "ssh");
		try {
			writeFileSync(sshPath, "#!/bin/sh\nkill -TERM $$\n", { mode: 0o755 });
			chmodSync(sshPath, 0o755);

			writeFileSync(
				join(configDir, "pods.json"),
				JSON.stringify(
					{
						active: "demo",
						pods: {
							demo: {
								ssh: `${sshPath} user@host`,
								gpus: [],
								models: {},
							},
						},
					},
					null,
					2,
				),
			);

			const result = spawnSync("npx", ["tsx", CLI_PATH, "shell"], {
				env: { ...process.env, PI_CONFIG_DIR: configDir },
				encoding: "utf-8",
			});

			assert.equal(result.status, 1);
		} finally {
			rmSync(configDir, { recursive: true, force: true });
			rmSync(scriptDir, { recursive: true, force: true });
		}
	});
});
