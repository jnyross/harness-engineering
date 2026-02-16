# Codebase Quality Audit — 2026-02-16

## Scope

Full monorepo review and remediation across:

- `packages/ai`
- `packages/agent`
- `packages/coding-agent`
- `packages/tui`
- `packages/web-ui`
- `packages/mom`
- `packages/pods`

Audit goals:

1. Remove concrete check/test friction.
2. Improve reliability and safety without changing product intent.
3. Keep changes aligned with architecture boundaries and existing methodologies.

## Findings and Actions

### 1) Root check reproducibility issues (web-ui + type resolution)

**Finding:** Root `npm run check` failed from a fresh source install because `web-ui` type checks relied on built declaration outputs from sibling packages.

**Action:** Updated local path mapping in:

- `packages/web-ui/tsconfig.json`
- `packages/web-ui/example/tsconfig.json`

to resolve internal dependencies from source paths.

**Result:** `npm run check` passes without requiring a prior monorepo build.

---

### 2) Cross-typing incompatibility in Codex provider helper

**Finding:** `headers.entries()` usage in `openai-codex-responses` caused typing incompatibility in some check flows.

**Action:** Switched header iteration to `Headers.forEach()` in:

- `packages/ai/src/providers/openai-codex-responses.ts`

**Result:** Type compatibility improved; no behavior change.

---

### 3) mom model selection hardcoded

**Finding:** mom runner used a hardcoded default model/provider in code.

**Action:** Added environment-driven model selection with validation in:

- `packages/mom/src/agent.ts`

Supported env vars:

- `PI_MOM_PROVIDER` / `MOM_MODEL_PROVIDER`
- `PI_MOM_MODEL` / `MOM_MODEL_ID`

Documented in:

- `packages/mom/README.md`

**Result:** Model choice is configurable while preserving previous defaults.

---

### 4) Reviewer contract drift in agent package

**Finding:** Reviewer parser/prompt were still centered on binary `[APPROVE]/[REJECT]`, while newer flow expects three outcomes.

**Action:** Updated reviewer prompt and parser to support:

- `approved`
- `needs_fixes`
- `rejected`

with backward compatibility for legacy tags.

Files:

- `packages/agent/src/reviewer.ts`
- `packages/agent/test/reviewer.test.ts`

**Result:** Review contract now matches newer TDD gate semantics and remains backward compatible.

---

### 5) Risky broad git operations in autonomous loop code

**Finding:** Agent loop orchestration still used broad/dangerous patterns (`git add -A`, `git checkout .`) in autonomous flows.

**Action:** Replaced with safer patterns in:

- `packages/agent/src/project-loop.ts`
- `packages/agent/src/tdd-loop.ts`

Specifically:

- stage explicit discovered changed files (tracked + untracked),
- use `git restore --worktree --source=HEAD -- .` for reset behavior.

**Result:** Lower risk of accidental unrelated staging and safer reset semantics.

---

### 6) Persistent storage dialog reliability

**Finding:** Storage permission flow had reliability issues around when browser persistence request was executed.

**Action:** Moved `navigator.storage.persist()` invocation into the direct user-click handler and simplified promise resolution flow:

- `packages/web-ui/src/dialogs/PersistentStorageDialog.ts`

Updated docs to remove stale “known broken” note:

- `packages/web-ui/README.md`

**Result:** More reliable persistent storage permission behavior.

---

### 7) Agent package tests required prebuilt internal dependencies

**Finding:** `@mariozechner/pi-agent-core` tests failed in source checkout when internal package entries were not prebuilt.

**Action:** Added Vitest aliasing in:

- `packages/agent/vitest.config.ts`

to resolve `@mariozechner/pi-ai` from source.

Also expanded biome include scope to lint package vitest configs and normalized formatting:

- `biome.json`
- `packages/ai/vitest.config.ts`
- `packages/coding-agent/vitest.config.ts`

**Result:** Agent package tests now run from source checkout without requiring prebuild artifacts.

## Validation Evidence

- Root quality gate passes:
  - `npm run check`
- Agent package tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test`
- Targeted reviewer parser tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- reviewer.test.ts`

## Remaining Notes

- `packages/agent/src/execution-engine.ts` appears legacy/unwired and still contains placeholder review behavior. This was intentionally left unchanged because it is not part of the active exported/used runtime path.

## Methodology Fit

Changes were constrained to correctness, safety, and maintainability, with no architecture boundary violations introduced and no expansion beyond existing package intent.
