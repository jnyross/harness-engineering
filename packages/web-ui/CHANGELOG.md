# Changelog

## [Unreleased]

### Fixed

- `PersistentStorageDialog` now requests `navigator.storage.persist()` directly from the user click handler and returns the actual browser grant result, improving reliability for persistent storage permission flows.
- Updated local TypeScript path mapping for package and example checks so web-ui typechecks reliably against source packages without requiring prebuilt declaration outputs.
- Re-enabled persistent storage permission requests in the example app now that `PersistentStorageDialog` is fixed, removing stale disabled code paths.
- `SandboxedIframe` now unregisters failed sandboxes and performs full cleanup on HTML validation failures in `execute()`, preventing stale router/listener state after early rejects.
- `SandboxedIframe.execute()` now removes pending `sandbox-ready`/`sandbox-error` window listeners during cleanup, preventing listener leaks when executions abort/timeout before sandbox bootstrap completes.
- `SandboxedIframe` now tracks and clears window-level sandbox handlers (`open-external-url` and bootstrap listeners) across reload/disconnect paths to prevent listener accumulation between loads.
- `ApiKeyPromptDialog` and `PersistentStorageDialog` now use single-settlement close handling for promise resolution, preventing duplicate completion paths when dialogs close after success/deny flows.
- `ApiKeyPromptDialog` now also ignores stale in-flight key polling callbacks after disconnect and settles outstanding prompts on detach, preventing dangling prompt promises when dialogs are removed externally.
- `PersistentStorageDialog` now invalidates stale in-flight permission requests on disconnect and settles outstanding prompts on detach, preventing stale async state updates and dangling request promises when dialogs are removed externally.
- Sandboxed runtime bridge request/response promises now clear timeout handlers on early completion and guard single settlement, preventing 30s timeout timer buildup during rapid runtime messaging.
- Sandboxed runtime bridge message handlers now ignore non-object postMessage payloads, preventing runtime handler crashes from unrelated window messages.
- Runtime message router now ignores non-object sandbox payloads and isolates provider/consumer handler exceptions so one faulty handler cannot crash global message routing.
- Runtime message router now falls back to the incoming message source window when sandbox iframe references are not yet attached, avoiding unnecessary request/response timeouts during early iframe lifecycle races.
- Runtime message router now ignores iframe messages whose `source` does not match the registered sandbox window, reducing cross-frame message spoofing risk.
- Runtime message router now guarantees a default runtime response for handled sandbox/user-script messages when providers don't respond explicitly, preventing avoidable bridge timeouts on fire-and-forget handlers.
- User-script runtime bridge requests now attach `messageId` values, and router user-script responses now settle unconditionally once per request to preserve sendMessage completion semantics.
- Runtime message router default acknowledgements are now gated to request messages carrying `messageId`, avoiding unsolicited responses for non-request sandbox broadcasts.
- `ProviderKeyInput` now tracks and clears delayed failure-reset timers across retries/disconnects, preventing stale timeout callbacks from mutating detached component state.
- `ProviderKeyInput` now sequence-guards async key status/test/save flows across disconnects, preventing stale async completions from mutating detached component state.
- `ConsoleBlock` now clears copy-feedback reset timers on repeated copy/disconnect paths, preventing stale timeout callbacks after component unmount.
- `AttachmentOverlay` now removes global keydown listeners and cancels in-flight preview loading in `disconnectedCallback()`, preventing listener/task leaks if the overlay is removed externally.
- `ChatPanel` now cancels its deferred initial resize `requestAnimationFrame` callback on disconnect, preventing stale update callbacks after rapid mount/unmount cycles.
- `StreamingMessageContainer` now tracks/cancels pending animation-frame batch updates on immediate clears and disconnects, preventing stale deferred render callbacks.
- `AgentInterface.setInput()` now coalesces deferred editor-population frames and cancels pending callbacks on disconnect, preventing runaway frame scheduling when the editor is unavailable.
- `AgentInterface.connectedCallback()` now aborts post-render listener setup when the component disconnects mid-await, preventing late observer/scroll listener attachment after teardown.
- `ArtifactsPanel` now tracks/cancels deferred animation-frame DOM updates across disconnects and skips callbacks when detached, preventing late artifact DOM mutations after unmount.
- `ConsoleRuntimeProvider` now replaces/cleans sandbox `error` and `unhandledrejection` listeners across executions, preventing listener accumulation between repeated HTML artifact runs.
- `ConsoleRuntimeProvider.complete()` now cleans runtime error listeners in a `finally` block, ensuring listener teardown even when runtime message delivery fails.
- `ModelSelector` now invalidates in-flight custom-provider discovery when disconnected, preventing stale async completion updates after dialog close/remount races.
- `ModelSelector.firstUpdated()` now exits when disconnected before post-render setup, preventing late focus/listener wiring after close races.
- `ProxyTab` now invalidates in-flight async settings loads across disconnects, preventing stale proxy state writes after tab unmount races.
- `ProvidersModelsTab` now sequence-guards custom-provider/status async loads across disconnects, preventing stale provider/status state writes after settings tab unmount/remount races.
- `CustomProviderDialog` now invalidates stale async test/save completions across disconnects, preventing detached dialog state updates and stale callback/close paths after unmount races.

## [0.52.12] - 2026-02-13

## [0.52.11] - 2026-02-13

## [0.52.10] - 2026-02-12

### Fixed

- Made model selector search case-insensitive by normalizing query tokens, fixing auto-capitalized mobile input filtering ([#1443](https://github.com/badlogic/pi-mono/issues/1443))

## [0.52.9] - 2026-02-08

## [0.52.8] - 2026-02-07

## [0.52.7] - 2026-02-06

## [0.52.6] - 2026-02-05

## [0.52.5] - 2026-02-05

## [0.52.4] - 2026-02-05

## [0.52.3] - 2026-02-05

## [0.52.2] - 2026-02-05

## [0.52.1] - 2026-02-05

## [0.52.0] - 2026-02-05

## [0.51.6] - 2026-02-04

## [0.51.5] - 2026-02-04

## [0.51.4] - 2026-02-03

## [0.51.3] - 2026-02-03

## [0.51.2] - 2026-02-03

## [0.51.1] - 2026-02-02

## [0.51.0] - 2026-02-01

## [0.50.9] - 2026-02-01

## [0.50.8] - 2026-02-01

## [0.50.7] - 2026-01-31

## [0.50.6] - 2026-01-30

## [0.50.5] - 2026-01-30

## [0.50.3] - 2026-01-29

## [0.50.2] - 2026-01-29

### Added

- Exported `CustomProviderCard`, `ProviderKeyInput`, `AbortedMessage`, and `ToolMessageDebugView` components for custom UIs ([#1015](https://github.com/badlogic/pi-mono/issues/1015))

## [0.50.1] - 2026-01-26

## [0.50.0] - 2026-01-26

## [0.49.3] - 2026-01-22

### Changed

- Updated tsgo to 7.0.0-dev.20260120.1 for decorator support ([#873](https://github.com/badlogic/pi-mono/issues/873))

## [0.49.2] - 2026-01-19

## [0.49.1] - 2026-01-18

## [0.49.0] - 2026-01-17

## [0.48.0] - 2026-01-16

## [0.47.0] - 2026-01-16

## [0.46.0] - 2026-01-15

## [0.45.7] - 2026-01-13

## [0.45.6] - 2026-01-13

## [0.45.5] - 2026-01-13

## [0.45.4] - 2026-01-13

## [0.45.3] - 2026-01-13

## [0.45.2] - 2026-01-13

## [0.45.1] - 2026-01-13

## [0.45.0] - 2026-01-13

## [0.44.0] - 2026-01-12

## [0.43.0] - 2026-01-11

## [0.42.5] - 2026-01-11

## [0.42.4] - 2026-01-10

## [0.42.3] - 2026-01-10

## [0.42.2] - 2026-01-10

## [0.42.1] - 2026-01-09

## [0.42.0] - 2026-01-09

## [0.41.0] - 2026-01-09

## [0.40.1] - 2026-01-09

## [0.40.0] - 2026-01-08

## [0.39.1] - 2026-01-08

## [0.39.0] - 2026-01-08

## [0.38.0] - 2026-01-08

## [0.37.8] - 2026-01-07

## [0.37.7] - 2026-01-07

## [0.37.6] - 2026-01-06

## [0.37.5] - 2026-01-06

## [0.37.4] - 2026-01-06

## [0.37.3] - 2026-01-06

## [0.37.2] - 2026-01-05

## [0.37.1] - 2026-01-05

## [0.37.0] - 2026-01-05

## [0.36.0] - 2026-01-05

## [0.35.0] - 2026-01-05

## [0.34.2] - 2026-01-04

## [0.34.1] - 2026-01-04

## [0.34.0] - 2026-01-04

## [0.33.0] - 2026-01-04

## [0.32.3] - 2026-01-03

## [0.32.2] - 2026-01-03

## [0.32.1] - 2026-01-03

## [0.32.0] - 2026-01-03

## [0.31.1] - 2026-01-02

## [0.31.0] - 2026-01-02

### Breaking Changes

- **Agent class moved to `@mariozechner/pi-agent-core`**: The `Agent` class, `AgentState`, and related types are no longer exported from this package. Import them from `@mariozechner/pi-agent-core` instead.

- **Transport abstraction removed**: `ProviderTransport`, `AppTransport`, `AgentTransport` interface, and related types have been removed. The `Agent` class now uses `streamFn` for custom streaming.

- **`AppMessage` renamed to `AgentMessage`**: Now imported from `@mariozechner/pi-agent-core`. Custom message types use declaration merging on `CustomAgentMessages` interface.

- **`UserMessageWithAttachments` is now a custom message type**: Has `role: "user-with-attachments"` instead of `role: "user"`. Use `isUserMessageWithAttachments()` type guard.

- **`CustomMessages` interface removed**: Use declaration merging on `CustomAgentMessages` from `@mariozechner/pi-agent-core` instead.

- **`agent.appendMessage()` removed**: Use `agent.queueMessage()` instead.

- **Agent event types changed**: `AgentInterface` now handles new event types from `@mariozechner/pi-agent-core`: `message_start`, `message_end`, `message_update`, `turn_start`, `turn_end`, `agent_start`, `agent_end`.

### Added

- **`defaultConvertToLlm`**: Default message transformer that handles `UserMessageWithAttachments` and `ArtifactMessage`. Apps can extend this for custom message types.

- **`convertAttachments`**: Utility to convert `Attachment[]` to LLM content blocks (images and extracted document text).

- **`isUserMessageWithAttachments` / `isArtifactMessage`**: Type guard functions for custom message types.

- **`createStreamFn`**: Creates a stream function with CORS proxy support. Reads proxy settings on each call for dynamic configuration.

- **Default `streamFn` and `getApiKey`**: `AgentInterface` now sets sensible defaults if not provided:
  - `streamFn`: Uses `createStreamFn` with proxy settings from storage
  - `getApiKey`: Reads from `providerKeys` storage

- **Proxy utilities exported**: `applyProxyIfNeeded`, `shouldUseProxyForProvider`, `isCorsError`, `createStreamFn`

### Removed

- `Agent` class (moved to `@mariozechner/pi-agent-core`)
- `ProviderTransport` class
- `AppTransport` class
- `AgentTransport` interface
- `AgentRunConfig` type
- `ProxyAssistantMessageEvent` type
- `test-sessions.ts` example file

### Migration Guide

**Before (0.30.x):**
```typescript
import { Agent, ProviderTransport, type AppMessage } from '@mariozechner/pi-web-ui';

const agent = new Agent({
  transport: new ProviderTransport(),
  messageTransformer: (messages: AppMessage[]) => messages.filter(...)
});
```

**After:**
```typescript
import { Agent, type AgentMessage } from '@mariozechner/pi-agent-core';
import { defaultConvertToLlm } from '@mariozechner/pi-web-ui';

const agent = new Agent({
  convertToLlm: (messages: AgentMessage[]) => {
    // Extend defaultConvertToLlm for custom types
    return defaultConvertToLlm(messages);
  }
});
// AgentInterface will set streamFn and getApiKey defaults automatically
```

**Custom message types:**
```typescript
// Before: declaration merging on CustomMessages
declare module "@mariozechner/pi-web-ui" {
  interface CustomMessages {
    "my-message": MyMessage;
  }
}

// After: declaration merging on CustomAgentMessages
declare module "@mariozechner/pi-agent-core" {
  interface CustomAgentMessages {
    "my-message": MyMessage;
  }
}
```
