import { describe, expect, it } from "vitest";
import { parseSseForImage } from "../examples/extensions/antigravity-image-gen.js";

describe("parseSseForImage", () => {
	it("parses terminal SSE data chunks without trailing newline", async () => {
		const imageChunk = {
			response: {
				candidates: [
					{
						content: {
							role: "model",
							parts: [
								{
									inlineData: {
										mimeType: "image/png",
										data: "ZmFrZS1pbWFnZS1kYXRh",
									},
								},
							],
						},
					},
				],
			},
		};

		const response = new Response(`data: ${JSON.stringify(imageChunk)}`, {
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
		});

		const result = await parseSseForImage(response);
		expect(result.image.mimeType).toBe("image/png");
		expect(result.image.data).toBe("ZmFrZS1pbWFnZS1kYXRh");
		expect(result.text).toEqual([]);
	});

	it("retains text deltas emitted before terminal image chunk", async () => {
		const textChunk = {
			response: {
				candidates: [
					{
						content: {
							role: "model",
							parts: [{ text: "Generating image..." }],
						},
					},
				],
			},
		};
		const imageChunk = {
			response: {
				candidates: [
					{
						content: {
							role: "model",
							parts: [{ inlineData: { mimeType: "image/jpeg", data: "aW1hZ2U=" } }],
						},
					},
				],
			},
		};

		const sseBody = `data: ${JSON.stringify(textChunk)}\n` + `data: ${JSON.stringify(imageChunk)}`;
		const response = new Response(sseBody, {
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
		});

		const result = await parseSseForImage(response);
		expect(result.text).toEqual(["Generating image..."]);
		expect(result.image.mimeType).toBe("image/jpeg");
		expect(result.image.data).toBe("aW1hZ2U=");
	});
});
