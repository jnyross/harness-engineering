import { describe, expect, it } from "vitest";
import { ansiToHtml } from "../src/core/export-html/ansi-to-html.js";

describe("ansiToHtml", () => {
	it("renders valid sgr parameters", () => {
		const html = ansiToHtml("\u001b[1;31mAlert\u001b[0m");
		expect(html).toContain("font-weight:bold");
		expect(html).toContain("color:#800000");
		expect(html).toContain(">Alert<");
	});

	it("does not partially coerce malformed sgr parameters", () => {
		const html = ansiToHtml("\u001b[1xmAlert\u001b[0m");
		expect(html).not.toContain("font-weight:bold");
		expect(html).toContain("Alert");
	});

	it("ignores out-of-range 256-color sgr values", () => {
		const html = ansiToHtml("\u001b[38;5;999mAlert\u001b[0m");
		expect(html).not.toContain("color:");
		expect(html).toContain("Alert");
	});

	it("ignores unsafe integer sgr values", () => {
		const html = ansiToHtml("\u001b[38;5;9007199254740993mAlert\u001b[0m");
		expect(html).not.toContain("color:");
		expect(html).toContain("Alert");
	});
});
