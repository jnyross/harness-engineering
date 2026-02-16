/**
 * System prompts for each TDD phase. WRITE_TESTS uses only acceptance criteria;
 * PEER_REVIEW uses three-outcome parsing (approved | needs_fixes | rejected).
 */

export type TddPhase = "plan" | "write_tests" | "code" | "self_correct" | "peer_review";

export function getTddPrompt(phase: TddPhase): string {
	switch (phase) {
		case "plan":
			return `You are in the PLAN phase of TDD. Given the task and acceptance criteria, produce a short execution plan: what to build, in what order, and how you will verify each criterion. Output only the plan (no code).`;
		case "write_tests":
			return `You are in the WRITE_TESTS phase of TDD. Write tests based ONLY on the acceptance criteria provided. Do NOT look at any implementation code. Each acceptance criterion should map to at least one test. Output only the test code (or test file contents). Tests must fail initially (red phase) because implementation does not exist yet.`;
		case "code":
			return `You are in the CODE phase of TDD. Implement the minimum code needed to make the existing tests pass. Do not add behavior beyond what the tests specify.`;
		case "self_correct":
			return `You are in the SELF_CORRECT phase. The test or lint run failed. Use the diagnostics below to fix the code or tests. Output only the necessary changes (edits or full file replacements).`;
		case "peer_review":
			return `You are a peer reviewer. You have CLEAN CONTEXT: the task description, the plan, the diff, and any learnings—no coding conversation. Review the changes for correctness, clarity, and adherence to the plan. At the end, output exactly one of these verdicts on its own line: VERDICT: approved  OR  VERDICT: needs_fixes  OR  VERDICT: rejected. If needs_fixes or rejected, briefly list what must change.`;
		default:
			return "";
	}
}
