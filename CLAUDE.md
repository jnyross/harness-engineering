# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Harness Engineering is a coding agent harness forked from [badlogic/pi-mono](https://github.com/badlogic/pi-mono). It is a TypeScript monorepo (npm workspaces, lockstep versioning) providing an LLM-powered coding agent with a minimal core (4 tools: read, write, edit, bash) and a rich extension system.

Upstream remote `upstream` tracks the original pi-mono repo. Our fork lives at `origin`.

## Build & Development Commands

```bash
npm install                    # Install all workspace dependencies
npm run build                  # Sequential build: tui -> ai -> agent -> coding-agent -> mom -> web-ui -> pods
npm run dev                    # Parallel tsc --watch across all packages
npm run check                  # Biome lint/format + TypeScript type check (run after every code change)
```

**Testing:**
```bash
npm test                       # Vitest across all packages
./test.sh                      # Runs tests with all API keys unset
# Single test (run from package root, not repo root):
npx tsx ../../node_modules/vitest/dist/cli.js --run test/specific.test.ts
```

**Important:** `npm run check` does NOT run tests. Always run it separately. Never run `npm run dev` or `npm run build` in agent sessions -- use `npm run check` instead.

## Monorepo Architecture

Seven packages with strict dependency ordering:

```
pi-tui (terminal UI framework, no deps)
  -> pi-ai (unified LLM API, 20+ providers)
       -> pi-agent-core (agent loop, state machine, tool execution)
            -> pi-coding-agent (CLI: interactive TUI, print mode, RPC mode, SDK)
                 -> pi-mom (Slack bot)
pi-web-ui (web components, depends on ai + tui)
pi (pods) (vLLM deployment CLI, depends on agent-core)
```

All packages share version numbers (lockstep). Releasing bumps everything together.

## Key Architectural Layers

### LLM Layer (`packages/ai`)
- `src/stream.ts` -- Main entry: auto-detects provider, returns `AssistantMessageEventStream`
- `src/providers/` -- One file per provider (openai, anthropic, google, bedrock, etc.)
- `src/models.ts` -- Model registry. `scripts/generate-models.ts` fetches latest from providers.
- `src/types.ts` -- Core types: `Model`, `Context`, `Tool`, `Api`, `StreamOptions`
- Tools defined with TypeBox schemas for validation

### Agent Loop (`packages/agent`)
- `src/agent.ts` -- `Agent` class with state machine (Idle -> Streaming -> ProcessingTools)
- `src/agent-loop.ts` -- Core loop: prompt -> LLM -> tool calls -> execute -> feed back -> repeat
- Steering queue (interrupt mid-turn) and follow-up queue (run after turn completes)
- Events: `agent_start -> turn_start -> message_start/update/end -> tool_execution -> turn_end -> agent_end`

### Coding Agent (`packages/coding-agent`)
- `src/cli.ts` -> `src/main.ts` -- Entry point, mode selection
- `src/modes/` -- interactive (TUI), print (non-interactive), rpc (JSON-RPC over stdio), json
- `src/core/agent-session.ts` -- Session lifecycle wrapper
- `src/core/session-manager.ts` -- JSONL persistence, tree-structured branching
- `src/core/tools/` -- Built-in tools: bash, read, write, edit, find, grep, ls
- Sessions auto-save to `~/.pi/agent/sessions/{working-directory-hash}/`

### Extension System (`packages/coding-agent/src/core/extensions/`)
- Factory pattern: `export default function(pi: ExtensionAPI) { ... }`
- `loader.ts` -- Discovers from `~/.pi/agent/extensions/`, `.pi/extensions/`, npm packages
- `runner.ts` -- Lifecycle management, event bus, sandboxed execution
- Extensions can register: tools, commands, shortcuts, event handlers, UI components, message renderers

### Skills & Resources (`packages/coding-agent/src/core/`)
- `skills.ts` -- Agent Skills spec (agentskills.io), markdown with YAML frontmatter
- `resource-loader.ts` -- Discovers resources from user global (`~/.pi/agent/`), project local (`.pi/`), and packages

### RPC Protocol (`packages/coding-agent/src/modes/rpc/`)
- JSON lines over stdin/stdout
- Commands: `prompt`, `steer`, `follow_up`, `abort`, `get_state`, `set_model`, `compact`, session management
- Responses: `{ type: "response", command, success, data }` and `{ type: "event", data: AgentEvent }`

## Code Standards

- **No `any` types** unless absolutely necessary
- **No inline imports** -- always use standard top-level `import` statements
- **Never hardcode keybindings** -- all keybindings go through `DEFAULT_EDITOR_KEYBINDINGS` or `DEFAULT_APP_KEYBINDINGS`
- **Biome** for formatting/linting: tabs (width 3), line width 120
- **TypeScript strict mode**, ES2022 target
- Read every file in full before editing it

## Git Workflow

- Never use `git add -A` or `git add .` -- always stage specific files
- Never use `git reset --hard`, `git checkout .`, `git clean -fd`, `git stash`, or `--no-verify`
- Commit messages: `fix(pkg): description`, include `fixes #N` or `closes #N` when applicable
- Don't commit unless explicitly asked
- Pull with `--rebase`, never force push

## Adding a New LLM Provider

Requires changes across 7 areas: types (`ai/src/types.ts`), provider impl (`ai/src/providers/`), stream integration (`ai/src/stream.ts`), model generation (`ai/scripts/generate-models.ts`), tests (11+ test files in `ai/test/`), coding-agent model resolver + CLI args, and documentation. See AGENTS.md for full checklist.

## Releasing

```bash
npm run release:patch    # Bug fixes and new features
npm run release:minor    # API breaking changes
```

Handles: version bump, CHANGELOG finalization, commit, tag, npm publish, and new `[Unreleased]` sections.
