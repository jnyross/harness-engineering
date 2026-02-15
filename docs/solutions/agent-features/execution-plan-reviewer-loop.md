---
title: "Execution Plans with Reviewer Loop for Autonomous Agent Runs"
date: "2026-02-15"
category: "agent-features"
component: "agent, coding-agent"
problem_type: "feature-implementation"
severity: "medium"
status: "in-progress"
tags: [execution-engine, decision-log, reviewer, planning, agent-tools, autonomous-agents, retry-loop]
related_issues: []
related_docs:
  - docs/plans/2026-02-15-feat-execution-plans-with-reviewer-loop-plan.md
  - docs/brainstorms/2026-02-15-execution-plans-with-reviewer-loop-brainstorm.md
---

# Execution Plans with Reviewer Loop

## Problem

Autonomous agent runs lacked structured execution tracking and validation. Agents could drift from their intended tasks without any review mechanism, and there was no persistent record of decisions made during execution.

### Symptoms

- No way to persist execution intent as a plan file
- No validation that work completed matches the plan
- No logging of approval/rejection decisions
- No retry mechanism when work doesn't pass review

## Root Cause

The existing agent architecture (`agentLoop` in `packages/agent/src/agent-loop.ts`) executed tasks in a single pass without:
1. A structured plan file to track intended work
2. A reviewer step to validate completed work
3. A decision log to record outcomes
4. A retry loop for failed attempts

The existing `plan-mode` extension provided read-only exploration with plan extraction, but lacked automated reviewer validation and was user-driven rather than agent-driven.

## Solution

Implemented four interconnected components that together provide plan-driven execution with reviewer validation:

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ExecutionEngine                          │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐    │
│  │  Agent Loop │ -> │  Reviewer   │ -> │ Decision Log │    │
│  │  (Worker)   │    │  (LLM Call) │    │  (Persist)   │    │
│  └─────────────┘    └─────────────┘    └──────────────┘    │
│         │                  │                   │            │
│         ▼                  ▼                   ▼            │
│  ┌──────────────────────────────────────────────────┐      │
│  │              EXECUTION_PLAN.md                    │      │
│  │  [ ] 1. Task one                                  │      │
│  │  [x] 2. Task two (completed)                      │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

#### 1. Execution Plan Tools (`packages/coding-agent/src/core/tools/execution-plan.ts`)

Four tools for plan management:

```typescript
// Tool: create_execution_plan
// Creates EXECUTION_PLAN.md with task checklist
export function createExecutionPlanTool(cwd: string, options?: PlanToolOptions): AgentTool {
  return {
    name: "create_execution_plan",
    label: "create_execution_plan",
    description: "Create a new execution plan as a markdown checklist.",
    parameters: createPlanSchema,
    execute: async (_toolCallId, params, _signal) => {
      const { tasks } = params as CreatePlanInput;
      const plan: ExecutionPlan = {
        created_at: new Date().toISOString(),
        tasks: tasks.map(description => ({ description, status: "pending" })),
      };
      await ops.writeFile(planPath, formatPlan(plan));
      return { content: [...], details: {} };
    },
  };
}

// Tool: update_plan_progress
// Updates task status (pending -> in_progress -> completed | blocked)
export function createUpdateProgressTool(cwd: string, options?: PlanToolOptions): AgentTool;

// Tool: get_execution_plan
// Returns current plan content
export function createGetPlanTool(cwd: string, options?: PlanToolOptions): AgentTool;

// Tool: validate_execution_plan
// Validates plan structure and returns status summary
export function createValidatePlanTool(cwd: string, options?: PlanToolOptions): AgentTool;
```

**Plan file format:**
```markdown
# Execution Plan

*Created: 2026-02-15T10:30:00.000Z*

[ ] 1. First task description
[x] 2. Second task description
[ ] 3. Third task description *(in progress)*
[ ] 4. Fourth task description *(blocked)*
```

#### 2. Reviewer (`packages/agent/src/reviewer.ts`)

Prompt template and response parser for plan validation:

```typescript
export const REVIEWER_SYSTEM_PROMPT = `You are a strict code reviewer. Your job is to validate that work completed matches the execution plan.

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
`;

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

  if (approveMatch) return { approved: true };
  if (rejectMatch) return { approved: false, reason: rejectMatch[1].trim() };

  return { approved: false, reason: "No clear approval or rejection found" };
}
```

#### 3. Decision Logger (`packages/agent/src/decision-log.ts`)

Append-only log for tracking review decisions:

```typescript
export class DecisionLogger {
  async logDecision(result: { approved: boolean; reason?: string; work_summary?: string }): Promise<void> {
    this.currentAttempt++;
    const entry: DecisionLogEntry = {
      timestamp: new Date().toISOString(),
      attempt: this.currentAttempt,
      status: result.approved ? "APPROVED" : "REJECTED",
      reason: result.reason,
      work_summary: result.work_summary,
    };
    await this.ops.appendFile(this.decisionPath, `${formatDecisionEntry(entry)}\n\n`);
  }
}
```

**Decision log format:**
```markdown
# Decision Log

*This log tracks review decisions for execution plan validation*

## 2026-02-15T10:35:00.000Z

### Attempt 1 - REJECTED
**Reason**: Work on authentication module not in plan

## 2026-02-15T10:40:00.000Z

### Attempt 2 - APPROVED
```

#### 4. Execution Engine (`packages/agent/src/execution-engine.ts`)

Wrapper around `agentLoop` with retry logic:

```typescript
export class ExecutionEngine {
  async runWithReview(
    prompts: AgentMessage[],
    context: AgentContext,
    config: AgentLoopConfig,
    signal?: AbortSignal,
  ): Promise<{ messages: AgentMessage[]; approved: boolean }> {
    if (!this.reviewConfig.enabled) {
      const stream = agentLoop(prompts, context, config, signal);
      return { messages: await stream.result(), approved: true };
    }

    while (this.retryCount < this.reviewConfig.maxRetries) {
      this.retryCount++;
      
      const stream = agentLoop(prompts, context, config, signal);
      const messages = await stream.result();
      
      const reviewResult = await this.runReview(messages);
      await this.decisionLogger.logDecision(reviewResult);
      
      if (reviewResult.approved) {
        return { messages, approved: true };
      }

      // Inject retry message with feedback
      prompts = [{
        role: "user",
        content: [{ type: "text", text: `Review feedback: ${reviewResult.reason}\n\nPlease address this feedback and try again.` }],
        timestamp: Date.now(),
      }];
    }

    return { messages: lastMessages, approved: false };
  }
}
```

### Integration Points

| Location | Integration |
|----------|-------------|
| `packages/coding-agent/src/core/tools/index.ts` | Export execution plan tools |
| `packages/coding-agent/src/core/sdk.ts` | Add to tool registry |
| `packages/agent/src/index.ts` | Export ExecutionEngine, DecisionLogger, reviewer |
| Agent session/loop | Wire `runWithReview` into execution path |

## Related Documentation

### Direct References
- `docs/plans/2026-02-15-feat-execution-plans-with-reviewer-loop-plan.md`: Implementation plan with acceptance criteria
- `docs/brainstorms/2026-02-15-execution-plans-with-reviewer-loop-brainstorm.md`: Design decisions and rationale
- `packages/agent/src/agent-loop.ts:28`: Core loop that ExecutionEngine wraps
- `packages/coding-agent/examples/extensions/plan-mode/`: Similar pattern (user-driven, no reviewer)

### Similar Patterns
- **plan-mode extension**: Read-only exploration with `[DONE:n]` markers; user-driven approval
- **subagent extension**: Has `reviewer.md` agent definition; separate process agents

## Prevention Strategies

### Best Practices

1. **Atomic Tool Design**: Keep execution plan tools as primitives. Let the agent compose complex behaviors.

2. **Explicit Completion Signals**: Require explicit status transitions. Never infer completion from heuristics.

3. **Full Context on Retry**: Pass complete review feedback + plan state + diff back to worker on rejection.

4. **Max Retry Enforcement**: Hard cap on retries (default: 3). Escalate to human after exhaustion.

5. **Same Model, Different Persona**: Use identical model for worker and reviewer with different system prompts.

6. **Git-Backed State**: All state lives in Git repository for session resumption.

### Common Pitfalls

| Pitfall | Prevention |
|---------|------------|
| Infinite retry loops | Hard cap of 3 retries with human escalation |
| Context loss on retry | Pass full reviewer feedback + plan + diff |
| Reviewer drift | Immutable system prompt; configurable strictness |
| Silent plan violations | Reviewer must match every diff to plan item |
| Race conditions | Atomic file writes with validation |

### Edge Cases

- **Empty plan**: Require at least one task before execution
- **Plan deleted mid-execution**: Halt and prompt user
- **Reviewer timeout**: Default 60s timeout; treat as rejection
- **Concurrent modifications**: Detect via timestamp/hash; re-validate
- **Diff too large**: Truncate with indication; flag incomplete review

## Testing Recommendations

### Unit Tests

- `create_execution_plan`: Valid tasks produce well-formed markdown
- `update_plan_progress`: Correct status transitions
- `parseReviewResponse`: `[APPROVE]` and `[REJECT] Reason:` parsing
- `DecisionLogger.logDecision`: Append-only, chronological entries
- `ExecutionEngine.runWithReview`: Retry count increment, max enforcement

### Integration Tests

- Worker creates plan, completes task, reviewer approves
- Worker drifts from plan, reviewer rejects, worker corrects
- Retry exhaustion triggers escalation

### Manual Verification

1. Start agent with simple task
2. Verify `EXECUTION_PLAN.md` created
3. Verify reviewer validates and approves
4. Verify `DECISION_LOG.md` entries

## Status

- [x] Execution plan tools created
- [x] Reviewer prompt and parser created
- [x] Decision logger created
- [x] Execution engine prototype created
- [ ] Hook tools into public registry
- [ ] Replace reviewer placeholder with actual LLM call
- [ ] Wire review loop into agent session
- [ ] Add unit tests
- [ ] Add integration tests
