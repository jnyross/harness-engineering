# Development Rules (table of contents)

Agent operating instructions and progressive disclosure: **CLAUDE.md**. Architecture boundaries: **ARCHITECTURE.md**.

## First message

If the user did not give a concrete task, read README.md, then ask which module(s) to work on. Read the relevant package READMEs: `packages/ai/README.md`, `packages/tui/README.md`, `packages/agent/README.md`, `packages/coding-agent/README.md`, `packages/mom/README.md`, `packages/pods/README.md`, `packages/web-ui/README.md`.

## Code quality

- No `any` types unless necessary; use node_modules for external API types.
- **No inline/dynamic imports** — no `await import("./foo.js")`, no `import("pkg").Type` in type positions. Use top-level imports only.
- Never remove or downgrade code to fix type errors; upgrade the dependency.
- Never hardcode key checks; use configurable keybindings with defaults.

## Commands

- After code changes: `npm run check` (full output). Fix all errors, warnings, and infos before committing. Note: `npm run check` does not run tests.
- Never run: `npm run dev`, `npm run build`, `npm test` unless the user asks.
- Run tests from the package root. When writing tests, run them and iterate until fixed.
- Never commit unless the user asks.

## GitHub issues

- Read: `gh issue view <number> --json title,body,comments,labels,state`.
- When creating issues: add `pkg:*` labels (pkg:agent, pkg:ai, pkg:coding-agent, pkg:tui, pkg:mom, pkg:pods, pkg:web-ui).
- When closing via commit: include `fixes #<number>` or `closes #<number>` in the message.

## PR workflow

- Analyze PRs without pulling locally first. If the user approves: feature branch, pull PR, rebase on main, apply adjustments, commit, merge into main, push, close PR. Never open PRs yourself.

## Knowledge base

- **docs/plans/** — Implementation plans.
- **docs/solutions/** — Institutional knowledge (query by topic).
- **docs/brainstorms/** — Brainstorm outputs.
- **docs/references/** — External docs, llms.txt.

## Style and commits

- Short, concise answers; no emojis; technical prose only.
- Commits: `type(scope): description`. Types: feat, fix, docs, refactor, test, chore, perf, ci, build, revert. Scopes: ai, agent, coding-agent, tui, mom, pods, web-ui, repo. Enforced by `.husky/commit-msg`.

## Changelog

- Location: `packages/*/CHANGELOG.md`. Sections: Breaking Changes, Added, Changed, Fixed, Removed. Entries under `## [Unreleased]` only; never modify released sections.

## Git rules (parallel agents)

- **Commit only files YOU changed.** Never `git add -A` or `git add .`. Use `git add <specific-file-paths>`.
- Forbidden: `git reset --hard`, `git checkout .`, `git clean -fd`, `git stash`, `git commit --no-verify`.
- Safe: `git status` → `git add <files>` → `git commit -m "..."` → `git pull --rebase && git push`. Never force push.

## Tool usage

- Never use sed/cat to read files; use the read tool (offset + limit for ranges).
- Read every file you modify in full before editing.

## Further detail

- Adding a new LLM provider: see `packages/ai/README.md` and docs/solutions/.
- Releasing: lockstep versioning; `npm run release:patch` or `npm run release:minor`.
- Testing pi TUI: see `docs/testing-tmux.md` if present.
