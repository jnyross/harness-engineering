import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { greenGate, parseCommand, redTestGate, validateReview } from "../src/gates.js";

const originalTestCommand = process.env.PI_TEST_COMMAND;
const originalValidateCommand = process.env.PI_VALIDATE_COMMAND;
const tempDirs: string[] = [];

function createTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "pi-agent-gates-test-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	process.env.PI_TEST_COMMAND = originalTestCommand;
	process.env.PI_VALIDATE_COMMAND = originalValidateCommand;
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("parseCommand", () => {
	it("parses quoted and escaped arguments", () => {
		expect(parseCommand(String.raw`node -e "console.log('ok')" --flag=value\ with\ spaces`)).toEqual([
			"node",
			"-e",
			"console.log('ok')",
			"--flag=value with spaces",
		]);
	});

	it("throws on unmatched quotes", () => {
		expect(() => parseCommand(`node -e "console.log('oops)`)).toThrow(/unmatched quote/i);
	});
});

describe("mechanical gates commands", () => {
	it("redTestGate reads PI_TEST_COMMAND at call-time", () => {
		process.env.PI_TEST_COMMAND = `node -e "process.exit(1)"`;
		expect(redTestGate(process.cwd()).passed).toBe(true);

		process.env.PI_TEST_COMMAND = `node -e "process.exit(0)"`;
		expect(redTestGate(process.cwd()).passed).toBe(false);
	});

	it("redTestGate fails when command cannot be parsed", () => {
		process.env.PI_TEST_COMMAND = `node -e "unterminated`;
		const result = redTestGate(process.cwd());
		expect(result.passed).toBe(false);
		expect(result.output).toMatch(/unmatched quote/i);
		expect(result.diagnostics?.[0]).toMatch(/failed to execute/i);
	});

	it("greenGate reads PI_VALIDATE_COMMAND at call-time", () => {
		process.env.PI_VALIDATE_COMMAND = `node -e "process.exit(0)"`;
		expect(greenGate(process.cwd()).passed).toBe(true);

		process.env.PI_VALIDATE_COMMAND = `node -e "process.exit(1)"`;
		expect(greenGate(process.cwd()).passed).toBe(false);
	});

	it("returns structured failure for invalid command syntax", () => {
		process.env.PI_VALIDATE_COMMAND = `node -e "unterminated`;
		const result = greenGate(process.cwd());
		expect(result.passed).toBe(false);
		expect(result.output).toMatch(/unmatched quote/i);
	});

	it("falls back to default test command when PI_TEST_COMMAND is blank", () => {
		process.env.PI_TEST_COMMAND = "   ";
		const result = redTestGate(createTempDir());
		expect(result.passed).toBe(true);
		expect(result.output).not.toMatch(/command is empty/i);
	});

	it("falls back to default validate command when PI_VALIDATE_COMMAND is blank", () => {
		process.env.PI_VALIDATE_COMMAND = "   ";
		const result = greenGate(createTempDir());
		expect(result.passed).toBe(false);
		expect(result.output).not.toMatch(/command is empty/i);
	});
});

describe("validateReview", () => {
	it("maps explicit reviewer verdicts to outcomes", () => {
		const result = validateReview("VERDICT: approved");
		expect(result.passed).toBe(true);
		expect(result.outcome).toBe("approved");
	});

	it("keeps clear reject outcomes parseable", () => {
		const result = validateReview("[REJECT] Reason: plan drift");
		expect(result.passed).toBe(true);
		expect(result.outcome).toBe("rejected");
	});

	it("fails gate when reviewer output is unparseable", () => {
		const result = validateReview("this seems mostly fine");
		expect(result.passed).toBe(false);
		expect(result.diagnostics?.[0]).toMatch(/could not be parsed/i);
	});
});
