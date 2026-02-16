# Agent operating instructions

Use this file for progressive disclosure: read the pointers below, then load only the docs relevant to the current task.

## Entry points

- **AGENTS.md** — Table of contents and development rules (first message, code quality, commands, PR workflow, git rules). Start here for repo conventions.
- **ARCHITECTURE.md** — Dependency boundaries and strict mode. Read before adding packages or new internal deps.
- **README.md** — Project overview and how to run/build.

## Knowledge base (docs/)

- **docs/plans/** — Active and completed implementation plans.
- **docs/solutions/** — Compound Engineering / institutional knowledge (categorized: build-errors, performance-issues, etc.). Query by topic when debugging or implementing.
- **docs/brainstorms/** — Brainstorm outputs and approach exploration.
- **docs/references/** — External references, llms.txt, and pinned docs.

All knowledge is repo-local and versioned.

## Package READMEs

For module-level context, read the README of the package you are changing:

- `packages/ai/README.md` — LLM abstraction, providers, streaming.
- `packages/agent/README.md` — Agent loop, TDD loop, project loop, gates.
- `packages/coding-agent/README.md` — CLI coding agent, tools, extensions.
- `packages/tui/README.md`, `packages/web-ui/README.md`, `packages/mom/README.md`, `packages/pods/README.md` — Supporting packages.

## Commands

- After code changes: `npm run check` (fix all errors/warnings/infos before committing).
- Never run `npm run dev`, `npm run build`, or `npm test` unless the user asks. For targeted tests, run from the package root.
