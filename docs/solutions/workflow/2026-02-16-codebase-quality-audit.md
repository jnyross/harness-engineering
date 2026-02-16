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

---

### 8) ExecutionEngine review step was a hardcoded placeholder

**Finding:** `ExecutionEngine` review mode always returned a placeholder rejection (`approved: false`) instead of performing a real review pass.

**Action:** Implemented real reviewer execution in:

- `packages/agent/src/execution-engine.ts`

using the existing reviewer prompt + parser contract and an LLM-backed review loop.

**Result:** Review mode now produces actual `approved/needs_fixes/rejected` outcomes rather than guaranteed retries/failures.

---

### 9) coding-agent test/runtime resolution gaps from source checkout

**Finding:** coding-agent tests and extension loading still had source-checkout friction:

- Vitest import resolution for internal monorepo packages required prebuilt dist entries.
- Extension loader alias resolution used `require.resolve(...)` only, which failed when sibling packages were not built.
- Git update tests used shorthand git sources instead of explicit `git:` prefixes required by strict parsing.

**Action:** Updated:

- `packages/coding-agent/vitest.config.ts` to resolve internal `@mariozechner/pi-*` packages from source.
- `packages/coding-agent/src/core/extensions/loader.ts` to fall back to sibling source entries when dist package entries are unavailable.
- `packages/coding-agent/test/git-update.test.ts` to use explicit `git:` source prefixes.

**Result:** coding-agent tests run successfully from source checkout, including extension-loading suites and git-update scenarios.

---

### 10) ExecutionEngine reviewer path lacked direct unit coverage

**Finding:** After implementing real reviewer execution in `ExecutionEngine`, there was no dedicated unit test coverage for retry/approval behavior.

**Action:** Added focused tests in:

- `packages/agent/test/execution-engine.test.ts`

covering:

- immediate approval (`VERDICT: approved`),
- retry when reviewer returns `needs_fixes`,
- rejection behavior when reviewer emits no assistant text.

**Result:** The reviewer execution path now has explicit regression coverage for core control flow.

---

### 11) ExecutionEngine decision logs omitted work summaries

**Finding:** `DecisionLogger` supports `work_summary`, but `ExecutionEngine` was not populating it when persisting review attempts.

**Action:** Updated:

- `packages/agent/src/execution-engine.ts`
- `packages/agent/test/execution-engine.test.ts`

to include summarized tool/work context in each logged review decision and to verify this behavior via unit tests.

**Result:** Decision logs now capture why a review failed/succeeded plus what work was attempted, improving auditability of retry cycles.

---

### 12) AI E2E test contained a silent no-op placeholder

**Finding:** In `packages/ai/test/stream.test.ts`, the Mistral “thinking mode” test body was fully commented out, causing a false-positive pass instead of an explicit skip.

**Action:** Converted that case to an explicit `it.skip(...)` with a clear rationale and preserved the intended test body for future re-enable.

**Result:** Test intent is now transparent; the suite no longer reports a misleading pass for a disabled scenario.

---

### 13) web-ui example still carried stale disabled persistence flow

**Finding:** The example app still had `PersistentStorageDialog` imports/calls commented out with “currently broken” TODO notes, despite the dialog fix.

**Action:** Re-enabled persistent storage prompt usage in:

- `packages/web-ui/example/src/main.ts`

and updated:

- `packages/web-ui/CHANGELOG.md`

to record the example app behavior alignment.

**Result:** Example behavior now matches the fixed dialog implementation and no longer advertises stale broken-state comments.

---

### 14) ExecutionEngine retry counters persisted across separate runs

**Finding:** `ExecutionEngine` stored retries in an instance field without resetting at the start of `runWithReview()`, so a previous run could exhaust retries for subsequent runs on the same instance.

**Action:** Updated:

- `packages/agent/src/execution-engine.ts`
- `packages/agent/test/execution-engine.test.ts`

to reset retry state per invocation and added regression coverage for sequential runs.

**Result:** Retry budgets are now applied independently per run, preventing unintended early exits in reused engine instances.

---

### 15) `pi agent` command in pods package was unimplemented

**Finding:** `packages/pods/src/commands/prompt.ts` terminated with `throw new Error("Not implemented")`, so `pi agent <model> ...` could never run.

**Action:** Implemented agent delegation flow in `prompt.ts`:

- create a temporary extension that registers a dynamic `pods-vllm` provider pointing at the selected pod/model endpoint,
- invoke coding-agent with that provider/model plus the pod-specific system prompt and user arguments,
- run coding-agent CLI via:
  - monorepo source fallback (`npx tsx packages/coding-agent/src/cli.ts`) during local development,
  - installed dist CLI when available,
  - npm package execution fallback (`npx --package @mariozechner/pi-coding-agent pi ...`) otherwise,
- return actionable error guidance when delegation fails and clean up temporary provider artifacts after execution.

**Result:** `pi agent` now executes the coding-agent CLI instead of hard-failing with a placeholder error.

---

### 16) pods `--pod` override could crash in `pi agent` flow

**Finding:** `promptModel()` assumed an override pod existed and directly dereferenced `loadConfig().pods[opts.pod]`, which could cause undefined access crashes for invalid pod names.

**Action:** Added explicit override pod validation in:

- `packages/pods/src/commands/prompt.ts`

with clear error messaging for unknown pod names.

**Result:** `pi agent ... --pod <name>` now fails gracefully with actionable feedback when the pod does not exist.

## Validation Evidence

- Root quality gate passes:
  - `npm run check`
- AI package tests pass:
  - `npm --workspace "@mariozechner/pi-ai" test`
- Agent package tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test`
- Targeted ExecutionEngine review tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- test/execution-engine.test.ts`
- Targeted AI stream mistral block run (all skipped as expected without creds):
  - `npm --workspace "@mariozechner/pi-ai" test -- test/stream.test.ts -t "Mistral Provider (devstral-medium-latest via OpenAI Completions)"`
- coding-agent package tests pass:
  - `npm --workspace "@mariozechner/pi-coding-agent" test`
- TUI package tests pass:
  - `npm --workspace "@mariozechner/pi-tui" test`
- Targeted reviewer parser tests pass:
  - `npm --workspace "@mariozechner/pi-agent-core" test -- reviewer.test.ts`
- web-ui package + example checks pass:
  - `cd packages/web-ui && npm run check`
- pods dynamic provider registration smoke test succeeds with temporary config:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts agent demo-model --list-models pods-vllm`
- pods missing override validation smoke test:
  - `PI_CONFIG_DIR=<tmp> npx tsx packages/pods/src/cli.ts agent demo-model --pod missing-pod`

## Methodology Fit

Changes were constrained to correctness, safety, and maintainability, with no architecture boundary violations introduced and no expansion beyond existing package intent.
