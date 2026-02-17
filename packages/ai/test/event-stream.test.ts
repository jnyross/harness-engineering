import { describe, expect, it } from "vitest";
import { EventStream } from "../src/utils/event-stream.js";

type TestEvent = { kind: "chunk"; value: string } | { kind: "done"; value: string };

function createTestStream() {
	return new EventStream<TestEvent, string>(
		(event) => event.kind === "done",
		(event) => event.value,
	);
}

describe("EventStream", () => {
	it("resolves final result from completion event", async () => {
		const stream = createTestStream();
		stream.push({ kind: "done", value: "finished" });
		stream.end();

		await expect(stream.result()).resolves.toBe("finished");
	});

	it("rejects final result when stream ends without completion event", async () => {
		const stream = createTestStream();
		stream.push({ kind: "chunk", value: "partial" });
		stream.end();

		await expect(stream.result()).rejects.toThrow("Event stream ended without completion event");
	});

	it("accepts explicit end result when no completion event was emitted", async () => {
		const stream = createTestStream();
		stream.push({ kind: "chunk", value: "partial" });
		stream.end("manual-result");

		await expect(stream.result()).resolves.toBe("manual-result");
	});
});
