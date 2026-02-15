---
title: "Transform Pi Fork into Harness-Engineered Coding Agent"
type: feat
date: 2026-02-15
deepened: 2026-02-15
reviewed: 2026-02-15
---

# Transform Pi Fork into Harness-Engineered Coding Agent

## Overview

Transform our Pi (badlogic/pi-mono) fork into a fully harness-engineered coding agent. Core principle: **every rule in documentation must be backed by mechanical enforcement**. Humans steer, agents execute, the toolchain ensures correctness.

## Problem Statement

Critical gaps between **stated rules and enforced rules**:

- `biome.json` has `noExplicitAny: "off"` but docs say "no `any` types" (487 occurrences across 107 files)
- `npm run check` uses `biome check --write` which mutates files — race condition in parallel-agent work (`package.json` line 18)
- `scripts/release.mjs` uses `git add .` while docs forbid it (lines 118, 135)
- `!!**/node_modules` in `biome.json` is a double-negation bug (line 38)
- Commit message format documented but not linted (71% conventional adherence)
- Dependency ordering documented but not tested
- "No inline imports" rule exists only as prose
- Single-platform CI; AGENTS.md is 217 lines (target: ~95)

## Technical Approach

### Phase 1: Fix Contradictions

Ship immediately. These are bugs, not features.

#### 1.1 Fix `--write` race condition

Fix in **both** locations simultaneously:

**`package.json` line 18:**
```json
"check": "biome check --error-on-warnings . && tsgo --noEmit && cd packages/web-ui && npm run check",
"format": "biome check --write ."
```

**`.husky/pre-commit`** — staged-files-only, no mutation, no tsgo (can't scope to staged files, blocks other agents):
```bash
#!/bin/sh
npx biome check --staged --error-on-warnings
```

**Files to modify:** `package.json`, `.husky/pre-commit`

#### 1.2 Fix release script `git add .`

```javascript
// Replace: execSync("git add .")
// With:    execSync("git add package.json packages/*/package.json packages/*/CHANGELOG.md")
```

**Files to modify:** `scripts/release.mjs`

#### 1.3 Fix `!!**/node_modules` bug in biome.json

Remove line 38 (`!!**/node_modules`) — double negation includes node_modules in lint scope.

**Files to modify:** `biome.json`

---

### Phase 2: Mechanical Enforcement

Every prose rule becomes a tooling rule. Complete as a batch to minimize the transition window.

#### 2.1 Enable `noExplicitAny` as `error` with suppressions

Skip `warn`. Set to `error` immediately with per-file suppressions.

1. Set `noExplicitAny: "error"` in `biome.json`
2. Add `// biome-ignore lint/suspicious/noExplicitAny: migration` to each existing violation
3. Quick win: `Model<any>` → `Model<Api>` is a mechanical find-replace (~67 violations)
4. Quick win: `args: any` → `args: Record<string, unknown>` in tool event types
5. CI step: `grep -rc "biome-ignore.*noExplicitAny" --include="*.ts" packages/ | awk -F: '{s+=$2}END{print s}'` — fail if count exceeds threshold hardcoded in CI step. Ratchet down.
6. Also enable `noExcessiveCognitiveComplexity: "warn"` (threshold 25) while editing biome.json

**Files to modify:** `biome.json`, all files with `any` violations

#### 2.2 Add commit message linting

20-line TypeScript script, zero new dependencies:

```typescript
// scripts/lint-commit-msg.ts
import { readFileSync } from "node:fs";

const TYPES = ["feat", "fix", "docs", "refactor", "test", "chore", "perf", "ci", "build", "revert"];
const SCOPES = ["ai", "agent", "coding-agent", "tui", "mom", "pods", "web-ui", "repo"];

const msg = readFileSync(process.argv[2], "utf-8").trim();
const pattern = new RegExp(`^(${TYPES.join("|")})(\\((${SCOPES.join("|")})\\))?!?: .{1,100}`);

if (!pattern.test(msg.split("\n")[0])) {
  console.error("Invalid commit message format.");
  console.error(`Expected: type(scope): description`);
  console.error(`Types: ${TYPES.join(", ")}`);
  console.error(`Scopes: ${SCOPES.join(", ")}`);
  process.exit(1);
}
```

Hook: `.husky/commit-msg` → `npx tsx scripts/lint-commit-msg.ts $1`

Add to AGENTS.md: `Commit format: type(scope): description. Valid scopes: ai, agent, coding-agent, tui, mom, pods, web-ui, repo`

**Files to create:** `scripts/lint-commit-msg.ts`, `.husky/commit-msg`

#### 2.3 Add structural architecture tests

Plain script, no vitest config needed:

```typescript
// scripts/check-architecture.ts
// 1. Read all packages/*/package.json, verify dependency hierarchy
// 2. Verify all packages have lockstep versions
// 3. Verify all packages have strict: true in tsconfig
// Exit 1 on failure
```

Integrate into `npm run check`:
```json
"check": "biome check --error-on-warnings . && tsgo --noEmit && tsx scripts/check-architecture.ts && cd packages/web-ui && npm run check"
```

**Files to create:** `scripts/check-architecture.ts`
**Files to modify:** `package.json`

#### 2.4 Final `npm run check` integration

After all enforcement is added:

```json
"check": "biome check --error-on-warnings . && tsgo --noEmit && tsx scripts/check-architecture.ts && (cd packages/web-ui && npm run check)"
```

Note: subshell `()` for the `cd` to prevent state leakage.

---

### Phase 3: Documentation Cleanup & Automated Tooling

#### 3.1 Slim AGENTS.md to ~95 lines

Extract procedural content to standalone docs:

| Section | New Location |
|---|---|
| Adding a New LLM Provider (lines 110-149) | `docs/adding-provider.md` |
| Releasing (lines 152-170) | `docs/releasing.md` |
| Testing pi Interactive Mode with tmux (lines 57-80) | `docs/testing-tmux.md` |
| Changelog format (lines 88-108) | `docs/changelog-format.md` |

**DO NOT extract** parallel-agent git rules (lines 176-217). Agents only reliably read AGENTS.md. These 36 lines prevent data loss and must stay inline.

Remove AGENTS.md / CLAUDE.md duplication. Keep safety-critical rules (no `git add .`, no `--hard` reset) redundant in both files.

**Files to modify:** `AGENTS.md`, `CLAUDE.md`
**Files to create:** 4 docs in `docs/`

#### 3.2 Add dead code detection

```bash
npm install --save-dev knip
```

```json
// knip.json
{
  "workspaces": {
    "packages/*": {
      "entry": ["src/index.ts", "src/cli.ts"],
      "project": ["src/**/*.ts", "test/**/*.ts"]
    }
  },
  "ignore": ["packages/coding-agent/examples/**"],
  "ignoreDependencies": ["@typescript/native-preview"]
}
```

Add `"dead-code": "knip"` to package.json. Start as CI warning (`knip || true`), promote to error after cleanup.

**Files to create:** `knip.json`
**Files to modify:** `package.json`, `.github/workflows/ci.yml`

#### 3.3 Split CI into parallel jobs

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, npm ci, npx biome ci .]

  typecheck:
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, npm ci, npx tsgo --noEmit]

  test:
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, npm ci, npm run build, npm test]

  dead-code:
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, npm ci, npx knip || true]
```

Use `biome ci` (not `biome check`) in CI — never writes files, correct exit codes.

**Files to modify:** `.github/workflows/ci.yml`

---

## Acceptance Criteria

### Phase 1
- [ ] `npm run check` does NOT use `--write`
- [ ] `npm run format` exists for developers who want auto-fix
- [ ] Pre-commit scopes biome to staged files only, no tsgo
- [ ] `scripts/release.mjs` uses explicit file paths
- [ ] `!!**/node_modules` removed from biome.json

### Phase 2
- [ ] `noExplicitAny: "error"` in biome.json with per-file suppressions
- [ ] CI fails if suppression count increases
- [ ] Commit messages linted by `.husky/commit-msg` hook
- [ ] Valid commit scopes documented in AGENTS.md
- [ ] Architecture checks (dependency hierarchy, lockstep versions, strict mode) integrated into `npm run check`
- [ ] `noExcessiveCognitiveComplexity: "warn"` enabled
- [ ] All builds pass

### Phase 3
- [ ] AGENTS.md under 100 lines
- [ ] Parallel-agent git rules remain in AGENTS.md (NOT extracted)
- [ ] 4 extracted docs exist in `docs/`
- [ ] knip runs in CI
- [ ] CI split into parallel jobs using `biome ci`

## Security Issues (File as Separate GitHub Issues)

1. **CRITICAL**: Extension auto-loading from `.pi/extensions/` — cloned repos can execute arbitrary code
2. **HIGH**: `resolveConfigValue` shell execution via `!` prefix in config values
3. **MEDIUM**: `auth.json` stores credentials in plaintext
4. **MEDIUM**: No command restriction for autonomous agents in bash tool
5. **LOW**: Extensions can silently modify system prompts via `onSystemPromptReady`

## Future Work (File as GitHub Issues When Needed)

- Dependabot or Renovate configuration
- Integration smoke test with mock LLM provider
- Secret scanning (gitleaks in CI)
- Agent skill for issue-to-fix workflow (`.pi/skills/fixing-issues/SKILL.md`)
- `useNodejsImportProtocol: "error"` (estimate violation count first)
- `noEmptyInterface: "error"`, `noNonNullAssertion: "warn"`
- macOS CI matrix (gate to main-only — 10x cost)
- Custom lint for inline imports (check if violations exist first)
- Test coverage reporting
- `docs/solutions/` directory for institutional knowledge

## Dependencies & Risks

**Build breakage from `noExplicitAny`**: ~155 per-file suppressions upfront. Ratchet ensures count only decreases. `Model<any>` → `Model<Api>` eliminates ~67 violations immediately.

**Agent behavior during transition**: Complete Phase 2 as a batch to minimize the window where some rules are enforced and others are prose-only.

**knip false positives**: Extension system's dynamic loading will trigger false positives. Configure `entry` patterns carefully.

**Pre-commit performance**: Staged-only biome check is fast. No tsgo in pre-commit (can't scope to staged files).

## References

- [OpenAI: Harness Engineering](https://openai.com/index/harness-engineering/)
- [Pi: The Minimal Agent Within OpenClaw](https://lucumr.pocoo.org/2026/1/31/pi/)
- `AGENTS.md` — Current rules (217 lines, target: ~95)
- `CLAUDE.md` — Architecture map (113 lines)
- `package.json:18` — `npm run check` with `--write` race condition
- `biome.json:38` — `!!**/node_modules` double-negation bug

## Research Notes

Full research from 13 deepening agents and 3 plan reviewers available at:
`docs/plans/2026-02-15-research-notes.md` (to be extracted from git history)
