import { describe, expect, it } from "vitest";
import { getOverlayQATestStartError } from "../examples/extensions/overlay-qa-test-status.js";

describe("getOverlayQATestStartError", () => {
	it("includes full stream command context", () => {
		expect(
			getOverlayQATestStartError({
				command: "bash",
				args: ["-c", "echo test"],
				error: new Error("ENOENT"),
			}),
		).toBe("Failed to start stream process 'bash -c echo test': ENOENT");
	});
});
