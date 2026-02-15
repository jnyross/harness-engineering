# Pi Monorepo - Project Overview

The Pi monorepo provides a complete toolkit for building AI agents and managing LLM deployments. It spans from low-level LLM API abstraction to end-user applications including a terminal coding assistant, web chat interface, Slack bot, and GPU infrastructure management.

## Architecture Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                         End-User Applications                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │ coding-agent │  │   web-ui    │  │     mom    │  │   pods   │  │
│  │  (Terminal)  │  │   (Web)     │  │  (Slack)   │  │ (GPU)    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬────┘  │
├─────────┼────────────────┼────────────────┼────────────────┼───────┤
│         │                │                │                │        │
│         ▼                ▼                ▼                ▼        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     pi-agent-core                            │   │
│  │        (Stateful agent with tool execution & events)        │   │
│  └─────────────────────────────┬───────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                         pi-ai                                │   │
│  │            (Unified multi-provider LLM API)                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                         pi-tui                                │   │
│  │           (Terminal UI framework - shared dependency)        │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Package Overview

### pi-ai (Core API Layer)
Unified interface to 15+ LLM providers including OpenAI, Anthropic, Google, Mistral, Groq, Cerebras, xAI, Amazon Bedrock, and OpenAI-compatible servers (Ollama, vLLM).

- **Streaming**: Unified event stream for text, tool calls, thinking/reasoning
- **Tool Calling**: Type-safe definitions using TypeBox schemas with automatic validation
- **Cross-Provider Handoffs**: Switch models mid-conversation with automatic message transformation
- **Token & Cost Tracking**: Built-in usage reporting per request
- **Context Serialization**: JSON-serializable conversation context

### pi-agent-core (Agent Runtime)
Stateful agent built on pi-ai with tool execution and event-driven architecture.

- **Event System**: `agent_start`, `turn_start`, `message_update`, `tool_execution_*`, etc.
- **Tool Execution**: Automatic tool calling loop with streaming support
- **Steering/Follow-up**: Queue messages while agent is running
- **Custom Message Types**: Extend via declaration merging
- **Low-level API**: `agentLoop()` for custom implementations

### pi-coding-agent (Terminal Coding Assistant)
Interactive CLI agent with file system tools for local development.

- **Built-in Tools**: read, write, edit, bash, grep, find, ls
- **Sessions**: JSONL-based with tree structure, branching, and compaction
- **Extensions**: TypeScript modules for custom tools, commands, UI
- **Skills**: Agent Skills standard for reusable capability packages
- **Themes**: Hot-reloadable terminal styling
- **Modes**: Interactive, print, JSON, RPC

### pi-tui (Terminal UI Framework)
Minimal TUI library with differential rendering for flicker-free updates.

- **Three-strategy Rendering**: First render, full re-render, incremental update
- **Synchronized Output**: Uses CSI 2026 for atomic screen updates
- **Components**: Text, Editor, Markdown, SelectList, SettingsList, Image
- **IME Support**: Proper cursor positioning for CJK input
- **Custom Components**: Simple Component interface with `render(width): string[]`

### pi-web-ui (Web Chat Interface)
Web components built on mini-lit and Tailwind CSS for browser-based AI chat.

- **ChatPanel**: Complete chat interface with streaming and artifacts
- **Tools**: JavaScript REPL, document extraction (PDF, DOCX, XLSX)
- **Artifacts**: Sandboxed HTML, SVG, Markdown rendering
- **Storage**: IndexedDB-backed persistence for sessions, keys, settings
- **Custom Providers**: Support for Ollama, LM Studio, vLLM

### pi-mom (Slack Bot)
LLM-powered Slack assistant that executes bash commands and manages files.

- **Slack Integration**: Socket Mode for real-time messaging
- **Docker Sandbox**: Isolated execution environment (recommended)
- **Per-Channel Context**: Separate conversation history per channel/DM
- **Memory**: Global and channel-specific MEMORY.md files
- **Skills**: Custom CLI tools (SKILL.md format)
- **Events**: Scheduled wake-ups via JSON files (one-shot, periodic)

### pi-pods (GPU Infrastructure)
CLI for deploying and managing vLLM on GPU pods.

- **Providers**: DataCrunch (NFS shared storage), RunPod, Vast.ai, custom
- **Automatic Configuration**: Tool calling presets for Qwen, GLM, GPT-OSS models
- **Multi-GPU**: Automatic GPU allocation for multiple models
- **OpenAI-Compatible API**: Standard `/v1/chat/completions` endpoints
- **Interactive Agent**: Built-in CLI for testing with file system tools

## Dependency Graph

```
pi-coding-agent ──► pi-agent-core ──► pi-ai
     │                   │
     └──────► pi-tui ◄───┘

pi-web-ui ───────► pi-agent-core ──► pi-ai
     │                   │
     └───────────────────┘

pi-mom ──────────► pi-agent-core ──► pi-ai

pi-pods ──────────► pi-ai (for pi-agent CLI)
```

## Design Philosophy

- **Minimal Core**: pi-ai and pi-agent-core provide bare abstraction; user-facing features come from extensions and packages
- **Extensibility Over Features**: pi-coding-agent adds capabilities via skills, extensions, and prompt templates rather than built-in functionality
- **No MCP**: Skills with READMEs replace Model Context Protocol
- **Self-Managing**: Agents (especially mom) install their own tools and manage their environment
- **Provider Agnostic**: Unified API layer abstracts LLM provider differences

## Quick Start

```bash
# Install coding agent
npm install -g @mariozechner/pi-coding-agent
export ANTHROPIC_API_KEY=sk-ant-...
pi

# Or use programmatic API
npm install @mariozechner/pi-ai @mariozechner/pi-agent-core
```
