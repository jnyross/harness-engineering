---
title: "Enforcing noExplicitAny and Architecture Rules in TypeScript Monorepo"
category: tooling-and-enforcement
tags: [biome, typescript, noExplicitAny, monorepo, husky, git-hooks, conventional-commits, architecture-checks, lint]
module: repo-wide
symptom: "any types proliferating silently, no architecture enforcement, no commit message standards"
root_cause: "biome noExplicitAny was off, no automated architecture checks existed, pre-commit hook was slow and unfocused"
severity: medium
impact: repo-wide
date_solved: "2026-02-15"
---

# Enforcing noExplicitAny and Architecture Rules in TypeScript Monorepo

## Problem

A TypeScript monorepo with 7 packages lacked enforcement of critical development standards:

- **Type safety**: `any` types were unrestricted (biome `noExplicitAny` was disabled)
- **Architecture violations**: No validation of dependency boundaries between packages
- **Version consistency**: No requirement for lockstep versioning across packages
- **Commit standards**: No format enforcement for commit messages
- **Performance**: Pre-commit hooks were slow, running full biome checks on all files

## Root Cause

The monorepo had no automated guardrails. Rules existed in documentation but were not enforced at the tooling layer. Pre-commit hooks and build scripts were inefficient, checking unnecessarily broad sets of files. Release automation used non-standard commit messages that conflicted with new linting rules.

**Core principle violated**: Every documented rule must have mechanical enforcement. Documentation without enforcement is wishful thinking.

## Solution

### 1. Type Safety Ratchet (biome noExplicitAny)

- Enabled `noExplicitAny` rule in `biome.json` (promoted from "off" to "error")
- Added 429 suppression comments (`// biome-ignore lint/suspicious/noExplicitAny: migration`) as a baseline for existing violations
- This creates a ratchet: blocks new `any` types while tracking existing ones for gradual cleanup
- Replaced generic `Model<any>` with properly constrained `Model<Api>` across 25 files (85 replacements), using `Api = KnownApi | (string & {})` pattern

### 2. Architecture Boundary Enforcement (`scripts/check-architecture.ts`)

Three complementary checks:

- **Lockstep Versioning**: All packages must have identical version numbers
- **Dependency Hierarchy**: Each package declares allowed internal dependencies. Build fails if dependencies violate the allowlist. Unknown packages fail immediately (not silently skipped).
- **TypeScript Strict Mode**: All `tsconfig.build.json` files must extend `tsconfig.base.json` or explicitly set `strict: true`

### 3. Commit Message Linting (`scripts/lint-commit-msg.ts`)

- Enforces Conventional Commits format: `type(scope): description`
- Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`
- Allowed scopes: `ai`, `agent`, `coding-agent`, `tui`, `mom`, `pods`, `web-ui`, `repo`
- Merge commits automatically pass
- Integrated via `.husky/commit-msg` hook

### 4. Pre-commit Hook Optimization

- Replaced 20-line full-repository biome check with: `npx biome check --staged --error-on-warnings`
- Only validates staged files, reducing execution time to ~200ms

### 5. Script Separation

- `npm run check`: Read-only validation (biome, tsgo, architecture) — no modifications
- `npm run format`: Auto-fix mode (biome --write) — modifies files

### 6. Release Automation Alignment

- Updated `scripts/release.mjs` commit messages to follow Conventional Commits format
- Changed from free-form messages to: `chore(repo): release v${version}`

### 7. Post-Review Corrections

Six parallel review agents identified and fixed:

- **Missing import**: `getModels` import removed during `Model<any>` replacement in `ModelSelector.ts`
- **Shell injection risk**: Unquoted `$1` in `.husky/commit-msg` wrapped in quotes
- **Silent failures**: Architecture check now fails on unknown packages instead of skipping
- **Read-only enforcement**: Removed errant `--write` flag from web-ui check script

## Verification

- **Type safety**: `npx biome check --error-on-warnings .` passes (477 files, 0 errors)
- **Architecture**: `npx tsx scripts/check-architecture.ts` passes
- **Type checking**: `npx tsgo --noEmit` passes clean
- **Commits**: Non-compliant commit messages are rejected at hook time
- **Performance**: Pre-commit checks complete in ~200ms

## Key Files Changed

| File | Change |
|------|--------|
| `biome.json` | Enabled noExplicitAny rule |
| `scripts/check-architecture.ts` | New architecture validation script |
| `scripts/lint-commit-msg.ts` | New commit message linting script |
| `.husky/commit-msg` | Commit message linting hook |
| `.husky/pre-commit` | Optimized to staged-only checks |
| `scripts/release.mjs` | Updated commit message format |
| `package.json` | Separated check/format scripts |
| 96+ source files | `// biome-ignore` suppressions |
| 25 files | `Model<any>` to `Model<Api>` |

## Prevention Strategies

1. **Suppression ratchet in CI**: Grep count of suppressions, fail if count increases above baseline (429)
2. **Monthly suppression audit**: Review suppressions for patterns that became fixable
3. **Type safety escalation path**: New rules start at `warn` (1 release), then promote to `error`
4. **Pre-push hook**: Full biome + architecture checks before push
5. **CODEOWNERS**: Assign type-safety rule changes to senior devs

## Ratchet Mechanism

```bash
# CI quality gate
CURRENT=$(grep -rc "biome-ignore lint/suspicious/noExplicitAny" packages/ | awk -F: '{sum+=$2} END {print sum}')
BASELINE=429

if [ "$CURRENT" -gt "$BASELINE" ]; then
  echo "Suppression count increased from $BASELINE to $CURRENT"
  exit 1
fi
```

- **Baseline**: 429 suppressions (current state)
- **Direction**: Ratchet down over time
- **Block increases**: Merge fails if suppressions grow

## Remaining Technical Debt

| Category | Count | Fix Pattern |
|----------|-------|-------------|
| Catch blocks | ~30 | `catch (e: any)` to `catch (e: unknown)` with type guard |
| Global declarations | ~20 | Consolidate into `/types/globals.d.ts` |
| Generic records | ~25 | `Record<string, any>` to `Record<string, unknown>` |
| Dead code | TBD | knip integration |
| CI split | TBD | Fast track (30s) + full track (5min) |

## Lessons Learned

1. **Suppressions are tracked debt**: 429 suppression comments are better than 0 enforcement. Each one is a known debt item with a clear fix path.
2. **Parallel review catches hidden issues**: 6-agent review found bugs (missing import, shell injection, silent failures) that the original implementation missed.
3. **Hook simplification improves adoption**: Staged-only biome check (~200ms) vs full-repo check (seconds) means developers actually leave hooks enabled.
4. **Mechanical enforcement beats documentation**: Architecture rules written in a README get violated. Architecture rules in `check-architecture.ts` don't.
5. **Separate read-only checks from auto-fix**: `check` and `format` are different operations with different safety profiles. Conflating them causes surprises.
