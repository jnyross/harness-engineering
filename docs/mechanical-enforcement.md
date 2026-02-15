# Mechanical Enforcement

This document lists all rules that are mechanically enforced in the codebase.

## Linting & Type Checking

| Rule | Enforcement | Configuration |
|------|-------------|---------------|
| No `any` types | Biome: `noExplicitAny: "error"` | `biome.json` |
| No inline imports | Custom checks in `npm run check` | - |
| Biome formatting | Biome: `biome check` | `biome.json` |
| TypeScript strict | All packages `strict: true` | `tsconfig.json` |

## Git Hooks

| Rule | Enforcement | Hook |
|------|-------------|------|
| Commit message format | Linted by `.husky/commit-msg` | `commit-msg` |
| Staged files only | Biome checks staged files only | `pre-commit` |

### Commit Message Format

```
type(scope): description
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`

Scopes: `ai`, `agent`, `coding-agent`, `tui`, `mom`, `pods`, `web-ui`, `repo`

## Architecture Checks

| Rule | Enforcement | Script |
|------|-------------|--------|
| Dependency ordering | Architecture tests | `scripts/check-architecture.ts` |
| Lockstep versions | Architecture tests | `scripts/check-architecture.ts` |
| Strict TypeScript | All packages `strict: true` | `tsconfig.json` |

## Code Quality

| Rule | Enforcement | Configuration |
|------|-------------|---------------|
| Keybindings configurable | Code review | `DEFAULT_EDITOR_KEYBINDINGS`, `DEFAULT_APP_KEYBINDINGS` |
| No hardcoded secrets | Code review | - |

## Running Checks

```bash
npm run check    # Runs all checks
```

This command:
1. Biome linting and formatting check
2. TypeScript type checking
3. Architecture constraint checks

## Suppressions

When suppressing rules (e.g., `// biome-ignore`), include a reason:
```typescript
// biome-ignore lint/suspicious/noExplicitAny: migration in progress
```
