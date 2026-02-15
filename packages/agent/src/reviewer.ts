import { type Static, Type } from "@sinclair/typebox";

export const REVIEWER_SYSTEM_PROMPT = `You are a strict code reviewer. Your job is to validate that work completed matches the execution plan.

## Your Task

Given an execution plan and the work that was completed, determine if the work aligns with the plan.

## Review Criteria

1. **Plan Alignment**: Does the completed work match what was in the plan?
2. **No Drift**: Did the agent work on items NOT in the plan?
3. **Progress**: Were completed items actually finished?

## Output Format

You MUST output one of:
- \`[APPROVE]\` - Work aligns with plan
- \`[REJECT]\` - Work does NOT align with plan

If REJECT, you MUST provide a reason in the format:
\`[REJECT] Reason: <explanation>\`

## Guidelines

- Be strict but fair
- If the agent made reasonable progress on planned items, approve it
- If the agent worked on items not in the plan, reject it
- If the agent didn't complete any planned items, reject it
`;

const reviewSchema = Type.Object({
	plan_content: Type.String({ description: "The execution plan document content" }),
	work_summary: Type.String({ description: "Summary of work completed (files changed, actions taken)" }),
});

export type ReviewInput = Static<typeof reviewSchema>;

export interface ReviewResult {
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
	const approveMatch = response.match(/\[APPROVE\]/i);
	const rejectMatch = response.match(/\[REJECT\]\s*Reason:\s*(.+)/i);

	if (approveMatch) {
		return { approved: true };
	}

	if (rejectMatch) {
		return {
			approved: false,
			reason: rejectMatch[1].trim(),
		};
	}

	return {
		approved: false,
		reason: "No clear approval or rejection found in response",
	};
}
