import { EventEmitter } from "node:events";
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

	it("rejects pending requests when stopped", async () => {
		const client = new RpcClient();

		let rejectionError: Error | undefined;
		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		(client as any).pendingRequests.set("req_1", {
			resolve: () => {},
			reject: (error: Error) => {
				rejectionError = error;
			},
		});

		const fakeProcess = new EventEmitter() as EventEmitter & {
			kill: (signal?: string) => boolean;
		};
		fakeProcess.kill = () => {
			setImmediate(() => fakeProcess.emit("exit", 0));
			return true;
		};

		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		(client as any).process = fakeProcess;

		await client.stop();
		expect(rejectionError?.message).toContain("RPC client stopped before response was received");
		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		expect((client as any).pendingRequests.size).toBe(0);
	});
});
