import { describe, expect, it } from "vitest";
import { parseReviewResponse } from "../src/reviewer.js";

describe("parseReviewResponse", () => {
	it("parses explicit approved verdict", () => {
		const result = parseReviewResponse("VERDICT: approved");
		expect(result.outcome).toBe("approved");
		expect(result.approved).toBe(true);
		expect(result.reason).toBeUndefined();
	});

	it("parses explicit needs_fixes verdict with reason", () => {
		const result = parseReviewResponse("VERDICT: needs_fixes\nReason: add missing validation for empty input");
		expect(result.outcome).toBe("needs_fixes");
		expect(result.approved).toBe(false);
		expect(result.reason).toBe("add missing validation for empty input");
	});

	it("keeps backward compatibility with legacy approve tag", () => {
		const result = parseReviewResponse("[APPROVE]");
		expect(result.outcome).toBe("approved");
		expect(result.approved).toBe(true);
	});

	it("handles legacy reject tag without reason", () => {
		const result = parseReviewResponse("[REJECT]");
		expect(result.outcome).toBe("rejected");
		expect(result.approved).toBe(false);
		expect(result.reason).toBe("Reviewer rejected the change");
	});

	it("falls back to rejected when response is unparseable", () => {
		const result = parseReviewResponse("looks mostly okay");
		expect(result.outcome).toBe("rejected");
		expect(result.approved).toBe(false);
		expect(result.reason).toContain("No clear approval");
	});
});
