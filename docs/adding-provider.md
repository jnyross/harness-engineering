# Adding a New LLM Provider

Adding a new LLM provider to pi-ai requires changes across multiple files.

## 1. Core Types (`packages/ai/src/types.ts`)

- Add API identifier to `Api` type union (e.g., `"bedrock-converse-stream"`)
- Create options interface extending `StreamOptions`
- Add mapping to `ApiOptionsMap`
- Add provider name to `KnownProvider` type union

## 2. Provider Implementation (`packages/ai/src/providers/`)

Create provider file exporting:
- `stream<Provider>()` function returning `AssistantMessageEventStream`
- `streamSimple<Provider>()` for `SimpleStreamOptions` mapping
- Provider-specific options interface
- Message conversion functions to transform `Context` to provider format
- Tool conversion if the provider supports tools
- Response parsing to emit standardized events (`text`, `tool_call`, `thinking`, `usage`, `stop`)

## 3. Stream Integration (`packages/ai/src/stream.ts`)

- Import provider's stream function and options type
- Add credential detection in `getEnvApiKey()`
- Add case in `mapOptionsForApi()` for `SimpleStreamOptions` mapping
- Add provider to `streamFunctions` map

## 4. API Registry (`packages/ai/src/providers/register-builtins.ts`)

- Register the API with `registerApiProvider()`

## 5. Model Generation (`packages/ai/scripts/generate-models.ts`)

- Add logic to fetch and parse models from the provider's source
- Map provider model data to the standardized `Model` interface
- Handle provider-specific quirks (pricing format, capability flags, model ID transformations)

## 6. Tests (`packages/ai/test/`)

Add provider to:
- `stream.test.ts`
- `tokens.test.ts`
- `abort.test.ts`
- `empty.test.ts`
- `context-overflow.test.ts`
- `image-limits.test.ts`
- `unicode-surrogate.test.ts`
- `tool-call-without-result.test.ts`
- `image-tool-result.test.ts`
- `total-tokens.test.ts`
- `cross-provider-handoff.test.ts`

For `cross-provider-handoff.test.ts`, add at least one provider/model pair. If the provider exposes multiple model families, add at least one pair per family.

For providers with non-standard auth (AWS, Google Vertex), create a utility with credential detection helpers.

## 7. Coding Agent Integration (`packages/coding-agent/`)

- `src/core/model-resolver.ts`: Add default model ID to `DEFAULT_MODELS`
- `src/cli/args.ts`: Add env var documentation
- `README.md`: Add provider setup instructions

## 8. Documentation

- `packages/ai/README.md`: Add to providers table, document options/auth, add env vars
- `packages/ai/CHANGELOG.md`: Add entry under `## [Unreleased]`

## Provider Types

### Standard Auth (API Key)
- OpenAI, Anthropic, Google, Mistral, Groq, Cerebras, xAI, etc.
- Use `getEnvApiKey()` for credential detection

### OAuth Providers
- Anthropic (Claude Pro/Max), OpenAI Codex, GitHub Copilot, Google Gemini CLI
- Use `login*` functions for authentication
- Handle token refresh

### AWS/Bedrock
- Use AWS credentials via `bedrock-utils.ts`
- Handle region selection

### Vertex AI
- Use Application Default Credentials (ADC)
- Handle project/location configuration

## Best Practices

1. Always use TypeBox for tool schema definitions
2. Test cross-provider handoffs with the new provider
3. Document environment variables in README
4. Add provider to the table in `packages/ai/README.md`
5. Include both streaming and non-streaming examples in tests
