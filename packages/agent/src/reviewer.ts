import { type Static, Type } from "@sinclair/typebox";

export const REVIEWER_SYSTEM_PROMPT = `You are a strict code reviewer. Your job is to validate that work completed matches the execution plan.

## Your Task

Given an execution plan and the work that was completed, determine if the work aligns with the plan.

## Review Criteria

1. **Plan Alignment**: Does the completed work match what was in the plan?
2. **No Drift**: Did the agent work on items NOT in the plan?
3. **Progress**: Were completed items actually finished?

## Output Format

You MUST output exactly one verdict:
- \`VERDICT: approved\` - Work aligns with plan
- \`VERDICT: needs_fixes\` - Work is close but requires fixes before approval
- \`VERDICT: rejected\` - Work does NOT align with plan

If verdict is \`needs_fixes\` or \`rejected\`, provide a reason in the format:
\`Reason: <explanation>\`

## Guidelines

- Be strict but fair
- If the agent made reasonable progress on planned items, approve it
- If the agent worked on items not in the plan, reject it
- If the agent didn't complete any planned items, reject it
- Use \`needs_fixes\` when the direction is correct but concrete issues remain
`;

const reviewSchema = Type.Object({
	plan_content: Type.String({ description: "The execution plan document content" }),
	work_summary: Type.String({ description: "Summary of work completed (files changed, actions taken)" }),
});

export type ReviewInput = Static<typeof reviewSchema>;

export type ReviewOutcome = "approved" | "needs_fixes" | "rejected";

export interface ReviewResult {
	outcome: ReviewOutcome;
	approved: boolean;
	reason?: string;
}

export function createReviewerPrompt(input: ReviewInput): string {
	return `${REVIEWER_SYSTEM_PROMPT}

## Execution Plan

\`\`\`
${input.plan_content}
\`\`\`

## Work Completed

${input.work_summary}

## Review

Output your review decision now:`;
}

export function parseReviewResponse(response: string): ReviewResult {
	const verdictMatch = response.match(
		/(?:^|\n)\s*(?:VERDICT|OUTCOME|RESULT)\s*:\s*(approved|needs_fixes|rejected)\b/i,
	);
	if (verdictMatch) {
		const outcome = verdictMatch[1].toLowerCase() as ReviewOutcome;
		const reasonMatch = response.match(/(?:^|\n)\s*Reason\s*:\s*(.+)$/im);
		return {
			outcome,
			approved: outcome === "approved",
			reason: reasonMatch?.[1]?.trim(),
		};
	}

	const approveMatch = response.match(/\[APPROVE\]/i);
	if (approveMatch) {
		return { outcome: "approved", approved: true };
	}

	const rejectMatch = response.match(/\[REJECT\](?:\s*Reason:\s*(.+))?/i);
	if (rejectMatch) {
		return {
			outcome: "rejected",
			approved: false,
			reason: rejectMatch[1]?.trim() || "Reviewer rejected the change",
		};
	}

	if (/\bneeds?\s*fix(es)?\b/i.test(response)) {
		const reasonMatch = response.match(/(?:^|\n)\s*Reason\s*:\s*(.+)$/im);
		return {
			outcome: "needs_fixes",
			approved: false,
			reason: reasonMatch?.[1]?.trim() ?? "Reviewer requested fixes",
		};
	}

	return {
		outcome: "rejected",
		approved: false,
		reason: "No clear approval or rejection found in response",
	};
}
