import { describe, expect, it } from "vitest";
import { RpcClient } from "../src/modes/rpc/rpc-client.js";

describe("RpcClient.start", () => {
	it("rejects cleanly when node binary cannot be spawned", async () => {
		const client = new RpcClient({
			env: { PATH: "" },
		});

		await expect(client.start()).rejects.toThrow("Failed to start agent process");
		await expect(client.stop()).resolves.toBeUndefined();
	});

	it("rejects when cli exits before initialization", async () => {
		const client = new RpcClient({
			cliPath: "/definitely/missing-cli.js",
		});

		await expect(client.start()).rejects.toThrow("Agent process exited before initialization");
		await expect(client.stop()).resolves.toBeUndefined();
	});
});
