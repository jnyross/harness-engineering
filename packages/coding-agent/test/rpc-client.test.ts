import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { RpcClient } from "../src/modes/rpc/rpc-client.js";

describe("RpcClient.start", () => {
	it("rejects cleanly when node binary cannot be spawned", async () => {
		const client = new RpcClient({
			env: { PATH: "" },
		});

		await expect(client.start()).rejects.toThrow("Failed to start agent process 'node dist/cli.js --mode rpc'");
		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		expect((client as any).processExitListener).toBeNull();
		await expect(client.stop()).resolves.toBeUndefined();
	});

	it("rejects when cli exits before initialization", async () => {
		const client = new RpcClient({
			cliPath: "/definitely/missing-cli.js",
		});

		await expect(client.start()).rejects.toThrow(
			"Agent process 'node /definitely/missing-cli.js --mode rpc' exited before initialization",
		);
		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		expect((client as any).processExitListener).toBeNull();
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

	it("rejects pending requests when process exits unexpectedly", () => {
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
			removeListener: (event: string, listener: (...args: unknown[]) => void) => EventEmitter;
		};

		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		(client as any).process = fakeProcess;
		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		(client as any).attachProcessExitListener(fakeProcess);

		fakeProcess.emit("exit", 9, null);

		expect(rejectionError?.message).toContain("process exited before response was received");
		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		expect((client as any).pendingRequests.size).toBe(0);
		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		expect((client as any).process).toBeNull();
		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		expect((client as any).processExitListener).toBeNull();
		expect(fakeProcess.listenerCount("exit")).toBe(0);
	});

	it("cleans up pending request when stdin write throws", async () => {
		const client = new RpcClient();

		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		(client as any).process = {
			stdin: {
				write: () => {
					throw new Error("stdin closed");
				},
			},
		};

		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		await expect((client as any).send({ type: "abort" })).rejects.toThrow("stdin closed");
		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		expect((client as any).pendingRequests.size).toBe(0);
	});

	it("rejects send when stdin is not writable", async () => {
		const client = new RpcClient();

		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		(client as any).process = {
			stdin: {
				destroyed: true,
				writableEnded: true,
				write: () => true,
			},
		};

		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		await expect((client as any).send({ type: "abort" })).rejects.toThrow("Client stdin is not writable");
		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		expect((client as any).pendingRequests.size).toBe(0);
	});

	it("cleans up pending request when stdin write callback returns error", async () => {
		const client = new RpcClient();

		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		(client as any).process = {
			stdin: {
				destroyed: false,
				writableEnded: false,
				write: (_chunk: string, callback?: (error?: Error | null) => void) => {
					callback?.(new Error("write callback failure"));
					return true;
				},
			},
		};

		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		await expect((client as any).send({ type: "abort" })).rejects.toThrow("write callback failure");
		// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
		expect((client as any).pendingRequests.size).toBe(0);
	});

	it("cleans up pending request on send timeout", async () => {
		vi.useFakeTimers();
		try {
			const client = new RpcClient();

			// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
			(client as any).process = {
				stdin: {
					write: () => true,
				},
			};

			// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
			const sendPromise = (client as any).send({ type: "abort" });
			const rejection = expect(sendPromise).rejects.toThrow("Timeout waiting for response to abort");
			await vi.advanceTimersByTimeAsync(30000);
			await rejection;

			// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
			expect((client as any).pendingRequests.size).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});

	it("forces SIGKILL when process does not exit after SIGTERM", async () => {
		vi.useFakeTimers();
		try {
			const client = new RpcClient();
			const signals: string[] = [];

			const fakeProcess = new EventEmitter() as EventEmitter & {
				kill: (signal?: string) => boolean;
			};
			fakeProcess.kill = (signal?: string) => {
				signals.push(signal ?? "SIGTERM");
				if (signal === "SIGKILL") {
					setImmediate(() => fakeProcess.emit("exit", 0));
				}
				return true;
			};

			// biome-ignore lint/suspicious/noExplicitAny: test instrumentation
			(client as any).process = fakeProcess;

			const stopPromise = client.stop();
			await vi.advanceTimersByTimeAsync(1000);
			await stopPromise;

			expect(signals).toEqual(["SIGTERM", "SIGKILL"]);
			expect(fakeProcess.listenerCount("exit")).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});
});
