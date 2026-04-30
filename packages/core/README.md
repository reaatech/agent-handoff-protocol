# @reaatech/agent-handoff

[![npm version](https://img.shields.io/npm/v/@reaatech/agent-handoff.svg)](https://www.npmjs.com/package/@reaatech/agent-handoff)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/agent-handoff-protocol/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/agent-handoff-protocol/ci.yml?branch=main&label=CI)](https://github.com/reaatech/agent-handoff-protocol/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Core types, utilities, and configuration for the Agent Handoff Protocol. This package is the foundation that all other `@reaatech/agent-handoff-*` packages build on.

## Installation

```bash
npm install @reaatech/agent-handoff
# or
pnpm add @reaatech/agent-handoff
```

## Feature Overview

- **35+ exported types** — every handoff domain concept has a corresponding type: payloads, agents, routing decisions, triggers, messages, and more
- **7 typed error classes** — `HandoffError` hierarchy with `TransportError`, `ValidationError`, `TimeoutError`, `RejectionError`, `RoutingError`, `CompressionError`, `ConfigurationError`
- **Typed event emitter** — `TypedEventEmitter<EventMap>` with type-safe `on`/`off`/`once`/`emit` for lifecycle observability
- **Retry utility** — `withRetry` with configurable exponential/linear backoff and full jitter
- **Config factory** — `createHandoffConfig` with deeply merged sensible defaults
- **Zero runtime dependencies** — everything is built-in or injected by the consumer
- **Dual ESM/CJS output** — works with `import` and `require`

## Quick Start

```typescript
import {
  createHandoffConfig,
  defaultHandoffConfig,
  HandoffError,
  TypedEventEmitter,
  withRetry,
  pickDefined,
} from '@reaatech/agent-handoff';
import type {
  HandoffPayload,
  AgentCapabilities,
  RoutingDecision,
  HandoffConfig,
  Message,
} from '@reaatech/agent-handoff';

// Create a configuration with defaults
const config = createHandoffConfig({
  routing: { minConfidenceThreshold: 0.6 },
});

// Use the typed event emitter
const emitter = new TypedEventEmitter<{ update: { id: string } }>();
emitter.on('update', ({ id }) => console.log(id));

// Retry with backoff
const result = await withRetry(() => fetchSomething(), {
  maxRetries: 3,
  backoff: 'exponential',
  baseDelayMs: 100,
  maxDelayMs: 5000,
  shouldRetry: (err) => err instanceof Error,
});
```

## Exports

### Types

| Export | Description |
|---|---|
| `HandoffPayload` | Complete handoff data: session history, compressed context, metadata |
| `CompressedContext` | Compression output: summary, key facts, intents, entities, open items |
| `AgentCapabilities` | Agent descriptor: skills, domains, load, languages, availability |
| `RoutingDecision` | Discriminated union: `PrimaryRoute` \| `ClarificationRoute` \| `FallbackRoute` |
| `HandoffConfig` | Compression, routing, transport, and trigger configuration |
| `HandoffTrigger` | Discriminated union of 5 trigger types |
| `HandoffContext` | Input context for `HandoffManager.executeHandoff()` |
| `HandoffOptions` | Optional overrides: source agent, timeout, transport preference |
| `HandoffResult` | Result type: success/failure, receiving agent, routing decision |
| `Message` | Conversation message: id, role, content, timestamp |
| `TransportLayer` | Interface: `sendHandoff`, `validateConnection`, `getCapabilities` |
| `ContextCompressor` | Interface: `compress` + `estimateTokens` |
| `HandoffRouter` | Interface: `route` returning a `RoutingDecision` |
| `DeepPartial` | Recursive partial utility type |

### Errors

All errors extend `HandoffError` which includes `code: HandoffErrorCode`, `message: string`, and optional `details`.

| Class | Code | When |
|---|---|---|
| `HandoffError` | (custom) | Base class for all handoff errors |
| `TransportError` | `transport_error` | Transport layer failure |
| `ValidationError` | `validation_error` | Payload incompatible with target agent; includes `validationErrors[]` |
| `TimeoutError` | `timeout_error` | Handoff exceeded timeout; includes `timeoutMs` |
| `RejectionError` | `rejection_error` | Target agent rejected; includes `rejectionReason` |
| `RoutingError` | `routing_error` | No suitable agent found |
| `CompressionError` | `compression_error` | Context compression failed |
| `ConfigurationError` | `configuration_error` | Invalid configuration |

### Utilities

| Export | Description |
|---|---|
| `TypedEventEmitter<EventMap>` | Type-safe event emitter with `on`, `off`, `once`, `emit` |
| `withRetry` | Async retry with exponential/linear backoff + full jitter |
| `pickDefined` | Build object from key-value pairs, omitting `undefined` values |
| `createHandoffConfig` | Deep-merge partial config with `defaultHandoffConfig` |
| `defaultHandoffConfig` | Sensible defaults for compression, routing, transport, triggers |

## Related Packages

- [`@reaatech/agent-handoff-compression`](https://www.npmjs.com/package/@reaatech/agent-handoff-compression) — Context compression strategies
- [`@reaatech/agent-handoff-routing`](https://www.npmjs.com/package/@reaatech/agent-handoff-routing) — Agent routing engine
- [`@reaatech/agent-handoff-transport`](https://www.npmjs.com/package/@reaatech/agent-handoff-transport) — MCP and A2A transports
- [`@reaatech/agent-handoff-validation`](https://www.npmjs.com/package/@reaatech/agent-handoff-validation) — Payload validation
- [`@reaatech/agent-handoff-protocol`](https://www.npmjs.com/package/@reaatech/agent-handoff-protocol) — Full orchestration layer

## License

[MIT](https://github.com/reaatech/agent-handoff-protocol/blob/main/LICENSE)
