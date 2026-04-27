<p align="center">
  <h1 align="center">Agent Handoff Protocol</h1>
  <p align="center">
    A minimal, transport-agnostic TypeScript library for transferring conversational state between AI agents &mdash; with intelligent routing, context compression, and graceful rejection handling.
  </p>
</p>

<p align="center">
  <a href="https://github.com/reaatech/agent-handoff-protocol/actions/workflows/ci.yml"><img src="https://github.com/reaatech/agent-handoff-protocol/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@reaatech/agent-handoff-protocol"><img src="https://img.shields.io/npm/v/@reaatech/agent-handoff-protocol" alt="npm" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/@reaatech/agent-handoff-protocol" alt="License" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/node/v/@reaatech/agent-handoff-protocol" alt="Node" /></a>
</p>

---

## Table of Contents

- [Why This Exists](#why-this-exists)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Handoff Triggers](#handoff-triggers)
  - [Payload Structure](#payload-structure)
  - [Route / Clarify / Fallback](#route--clarify--fallback)
- [Features](#features)
  - [Context Compression](#context-compression)
  - [Routing Engine](#routing-engine)
  - [Transport Layer](#transport-layer)
  - [Rejection Handling](#rejection-handling)
  - [Error Hierarchy](#error-hierarchy)
  - [Observability](#observability)
- [Configuration Reference](#configuration-reference)
- [API Overview](#api-overview)
- [Architecture](#architecture)
- [Examples](#examples)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License](#license)

## Why This Exists

In multi-agent systems, the handoff is the hardest part to get right. When an agent hits the limits of its expertise, you need reliable answers to questions like:

- **What exactly gets passed?** The full history? A summary? Key facts only?
- **How much context is enough?** Too little and the receiving agent is confused. Too much and you blow through token budgets.
- **Who decides where to route?** And what happens when no agent is a clear match?
- **What if the target rejects the handoff?** Do you retry? Fall back? Alert someone?

The Agent Handoff Protocol provides a standardized, battle-tested answer to each of these questions &mdash; in ~30 KB gzipped with zero runtime dependencies.

**What this library is:**

- A focused library for the handoff lifecycle: `compress` &rarr; `route` &rarr; `validate` &rarr; `transport` &rarr; `accept` / `reject`
- Transport-agnostic, with built-in **MCP** (Model Context Protocol) and **A2A** (Agent-to-Agent HTTP) support
- Strictly typed (strict TypeScript, no `any` in the public API)
- Injectable &mdash; supply your own HTTP client, MCP adapter, or compressor strategy

**What this library is not:**

- A multi-agent orchestration framework
- A deployment platform (Kubernetes, containers, etc.)
- An observability stack (we emit typed events; you bring your own metrics)
- A circuit-breaker / dead-letter queue system (v1 uses retry + fallback)

---

## Installation

```bash
npm install @reaatech/agent-handoff-protocol
```

```bash
pnpm add @reaatech/agent-handoff-protocol
```

```bash
yarn add @reaatech/agent-handoff-protocol
```

**Requirements:** Node.js 20+, TypeScript 5.6+ (strict mode recommended). The library ships ESM with a CommonJS fallback.

**Optional peer dependency:** `zod` (^3.23.0) enables rich runtime validation. Without it, validation falls back to manual checks with identical behavior.

---

## Quick Start

```typescript
import {
  HandoffManager,
  createHandoffConfig,
  HybridCompressor,
  CapabilityBasedRouter,
  TransportFactory,
  MCPTransport,
} from '@reaatech/agent-handoff-protocol';

// 1. Provide an MCP client (from @modelcontextprotocol/sdk or your own adapter)
const mcpClient = {
  async callTool(params: {
    serverId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  }) {
    return { accepted: true, responseCode: 200 };
  },
  async ping(serverId: string) {},
};

// 2. Wire up transport, compression, and routing
const config = createHandoffConfig({
  compression: { maxTokens: 2000, strategy: 'hybrid' },
  routing: { minConfidenceThreshold: 0.7, policy: 'best_effort' },
});

const manager = new HandoffManager(config, {
  router: new CapabilityBasedRouter(config.routing),
  compressor: new HybridCompressor(),
  transportFactory: new TransportFactory([new MCPTransport(mcpClient)]),
});

// 3. Register available agents
manager.registerAgent({
  agentId: 'billing-agent',
  agentName: 'Billing Specialist',
  skills: ['billing', 'refunds'],
  domains: ['finance'],
  maxConcurrentSessions: 10,
  currentLoad: 2,
  languages: ['en'],
  specializations: [],
  availability: 'available',
  version: '1.0.0',
});

// 4. Observe the handoff lifecycle
manager.on('handoffComplete', ({ handoffId, duration, receivingAgent }) => {
  console.log(`Handoff ${handoffId} completed to ${receivingAgent.agentName} in ${duration}ms`);
});

manager.on('handoffReject', ({ handoffId, reason }) => {
  console.warn(`Handoff ${handoffId} rejected: ${reason}`);
});

// 5. Execute a handoff
const result = await manager.executeHandoff({
  sessionId: 'session-123',
  conversationId: 'conv-456',
  messages: conversationHistory,
  trigger: {
    type: 'confidence_too_low',
    currentConfidence: 0.45,
    threshold: 0.6,
    message: 'User asked about billing — outside my domain',
  },
  userMetadata: { userId: 'user-789', language: 'en' },
  state: { resolvedEntities: {}, openQuestions: [], contextVariables: {} },
  availableAgents: [], // registered agents are merged automatically
});

if (result.success) {
  console.log(`Handed off to ${result.receivingAgent?.agentName}`);
} else {
  console.error(`Handoff failed: ${result.rejectionReason || result.error?.message}`);
}
```

---

## Core Concepts

### Handoff Triggers

Five trigger types cover the common reasons an agent needs to hand off a conversation:

| Trigger                  | Description                                        |
| ------------------------ | -------------------------------------------------- |
| `confidence_too_low`     | Agent confidence falls below configured threshold  |
| `topic_boundary_crossed` | Conversation crosses into a new domain             |
| `escalation_requested`   | User, agent, or system requests escalation         |
| `specialist_required`    | Required skills are missing from the current agent |
| `load_balancing`         | Distribute load across available agents            |

Every trigger is a discriminated union, so TypeScript narrows the type automatically in `switch` / `if` branches.

### Payload Structure

When a handoff executes, the library builds a `HandoffPayload` that includes both the full session history and a compressed representation:

```typescript
interface HandoffPayload {
  handoffId: string;
  sessionId: string;
  conversationId: string;
  sessionHistory: Message[]; // full conversation (for the receiving agent)
  compressedContext: {
    summary: string; // condensed version of the history
    keyFacts: KeyFact[]; // extracted facts with importance scores
    intents: Intent[]; // detected user intents
    entities: Entity[]; // named entities (resolved or not)
    openItems: OpenItem[]; // unanswered questions or pending actions
  };
  handoffReason: HandoffTrigger;
  userMetadata: UserMetadata;
  conversationState: ConversationState;
}
```

The receiving agent gets both the raw history and a structured summary &mdash; so it can pick up mid-sentence without re-reading everything.

### Route / Clarify / Fallback

The routing engine implements a three-outcome decision tree:

| Decision          | When                                                      | Action                                             |
| ----------------- | --------------------------------------------------------- | -------------------------------------------------- |
| **Primary**       | A clear best match with confidence &ge; threshold         | Route directly to the top agent                    |
| **Clarification** | Two or more candidates are within the ambiguity threshold | Return clarification questions for the user/caller |
| **Fallback**      | No match, all agents busy, or all rejected                | Emit rejection event; caller decides next step     |

This pattern was battle-tested in production at AskGM and generalized for the library.

---

## Features

### Context Compression

Three built-in strategies with a common interface:

| Strategy           | Behavior                                                           |
| ------------------ | ------------------------------------------------------------------ |
| `summary`          | Extractive summarization (sentence scoring); optional LLM hook     |
| `sliding_window`   | Keep the most recent _N_ messages within a token budget            |
| `hybrid` (default) | Sliding window for recency + extractive summary for older messages |

All compressors expose `estimateTokens(text)` for budget-aware workflows. You can implement `ContextCompressor` to plug in your own strategy without forking.

### Routing Engine

The `CapabilityBasedRouter` scores agents using a weighted multi-factor algorithm:

| Factor         | Weight | Description                                      |
| -------------- | ------ | ------------------------------------------------ |
| Skill match    | 40%    | Overlap between required skills and agent skills |
| Domain match   | 30%    | Alignment with agent's declared domains          |
| Load factor    | 20%    | Available capacity (penalizes busy agents)       |
| Language match | 10%    | User language preference compatibility           |

An `AgentRegistry` keeps agents in memory with health-check TTLs. You can register, unregister, and query agents at any time.

### Transport Layer

The `TransportLayer` interface abstracts how payloads are delivered. Two implementations ship out of the box:

**MCP Transport** &mdash; for Model Context Protocol environments:

- Converts `HandoffPayload` to an MCP tool call (`accept_handoff`)
- Validates connectivity via `ping`
- Works with any MCP-compatible client (inject your own adapter)

**A2A Transport** &mdash; for HTTP-based agent-to-agent communication:

- `POST {agentEndpoint}/handoffs` with JSON body
- Retries with exponential backoff on transient network errors
- Custom auth headers via constructor injection
- Health checks via `GET {agentEndpoint}/health`

**TransportFactory** handles selection logic:

- Auto-detects transport from agent metadata
- Respects preferred transport overrides
- Caches health check results with configurable TTL

### Rejection Handling

When a target agent rejects a handoff, the executor automatically tries the next-best alternative (up to `maxAlternatives`, default 3). If all alternatives reject, the library returns a `HandoffResult` with `success: false` and a `rejectionReason` string. The caller decides whether to queue for later, escalate, or alert.

### Error Hierarchy

All errors extend `HandoffError` with a typed `code` property, making it easy to handle specific failures:

```typescript
try {
  await manager.executeHandoff(context);
} catch (error) {
  if (error instanceof TransportError) {
    /* network issue */
  }
  if (error instanceof ValidationError) {
    /* payload invalid */
  }
  if (error instanceof TimeoutError) {
    /* handoff timed out */
  }
  if (error instanceof RejectionError) {
    /* all agents rejected */
  }
  if (error instanceof RoutingError) {
    /* no route found */
  }
  if (error instanceof CompressionError) {
    /* compression failed */
  }
  if (error instanceof ConfigurationError) {
    /* invalid config */
  }
}
```

### Observability

The library emits typed lifecycle events. You wire them to your own stack:

```typescript
manager.on('handoffStart', ({ handoffId, trigger }) => {
  tracer.startSpan('handoff', { attributes: { handoffId, trigger: trigger.type } });
});

manager.on('handoffComplete', ({ handoffId, duration, receivingAgent }) => {
  metrics.histogram('handoff.duration_ms', duration);
  metrics.increment('handoff.success');
});

manager.on('handoffReject', ({ handoffId, reason }) => {
  metrics.increment('handoff.rejected');
  logger.warn('Handoff rejected', { handoffId, reason });
});

manager.on('handoffError', ({ handoffId, error }) => {
  logger.error('Handoff failed', { handoffId, code: error.code });
});
```

No vendor lock-in. Use OpenTelemetry, Datadog, Pino, or plain `console.log`.

---

## Configuration Reference

All configuration is created through `createHandoffConfig()`, which merges your partial options with sensible defaults:

```typescript
const config = createHandoffConfig({
  compression: {
    maxTokens: 4096, // default: 2000
    strategy: 'hybrid', // 'summary' | 'sliding_window' | 'hybrid'
    preserveRecentMessages: 5, // always include last N messages verbatim (default: 3)
  },
  routing: {
    minConfidenceThreshold: 0.7, // minimum score to route directly (default: 0.7)
    ambiguityThreshold: 0.15, // max score gap before clarification (default: 0.15)
    maxAlternatives: 3, // max fallback candidates to try (default: 3)
    policy: 'best_effort', // 'strict' | 'best_effort' | 'hierarchical'
  },
  transport: {
    preferred: 'auto', // 'mcp' | 'a2a' | 'auto'
    timeout: 30000, // handoff timeout in ms (default: 30000)
    retries: 3, // max retry attempts (default: 3)
    requireExplicitAcceptance: true,
  },
  triggers: {
    confidenceThreshold: 0.6, // default: 0.6
    topicChangeThreshold: 0.8, // default: 0.8
    escalationKeywords: ['speak to manager', 'human agent', 'escalate'],
  },
});
```

All fields are optional; `createHandoffConfig()` fills in defaults for everything you omit.

---

## API Overview

### Primary Entry Point

```typescript
class HandoffManager {
  constructor(config: HandoffConfig, deps?: {
    router?: HandoffRouter;
    compressor?: ContextCompressor;
    transportFactory?: TransportFactory;
  });

  executeHandoff(context: HandoffContext, options?: HandoffOptions): Promise<HandoffResult>;
  registerAgent(capabilities: AgentCapabilities): void;
  unregisterAgent(agentId: string): void;
  getRegisteredAgents(): AgentCapabilities[];
  on<E extends keyof HandoffEventMap>(event: E, handler: ...): void;
  off<E extends keyof HandoffEventMap>(event: E, handler: ...): void;
}
```

### Config Factory

```typescript
function createHandoffConfig(options?: DeepPartial<HandoffConfig>): HandoffConfig;
```

### Key Exports

```typescript
// Implementations (for advanced composition)
export { HybridCompressor, SummaryCompressor, SlidingWindowCompressor, SimpleTokenCounter };
export { CapabilityBasedRouter, AgentRegistry };
export { MCPTransport, A2ATransport, TransportFactory };
export { HandoffValidator };
export { withRetry, TypedEventEmitter, pickDefined };

// Error classes
export {
  HandoffError,
  TransportError,
  ValidationError,
  TimeoutError,
  RejectionError,
  RoutingError,
  CompressionError,
  ConfigurationError,
};
```

Full typedoc-generated API documentation is available at [docs/](./docs/) (run `pnpm docs` to generate).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   Public API Layer                            │
│                   HandoffManager                              │
│       executeHandoff() · on() · registerAgent()              │
├──────────────────────────────────────────────────────────────┤
│                   Core Services Layer                         │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │HandoffExecutor │  │HandoffRouter │  │ContextCompressor│   │
│  │  compress →     │  │  score →     │  │  summary        │   │
│  │  route →        │  │  primary /   │  │  sliding window │   │
│  │  validate →     │  │  clarify /   │  │  hybrid         │   │
│  │  transport →    │  │  fallback    │  │                 │   │
│  │  handle reply   │  │              │  │                 │   │
│  └────────────────┘  └──────────────┘  └────────────────┘   │
│  ┌──────────────┐     ┌───────────────────┐                  │
│  │AgentRegistry │     │ HandoffValidator  │                  │
│  └──────────────┘     └───────────────────┘                  │
├──────────────────────────────────────────────────────────────┤
│                   Transport Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐          │
│  │MCPTransport│ │A2ATransport│ │ TransportFactory │          │
│  └──────────┘  └──────────┘  └───────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

The library is organized as thin, composable modules. Users import what they need; most users only need `HandoffManager` and `createHandoffConfig`. Advanced users can swap out any layer by implementing the relevant interface.

---

## Examples

The [`examples/`](./examples/) directory contains runnable samples:

| Example                                                   | Description                                       |
| --------------------------------------------------------- | ------------------------------------------------- |
| [`basic-handoff.ts`](./examples/basic-handoff.ts)         | Minimal MCP-based handoff setup                   |
| [`custom-compressor.ts`](./examples/custom-compressor.ts) | Plugging in a custom compression strategy         |
| [`custom-transport.ts`](./examples/custom-transport.ts)   | Adding a new transport implementation             |
| [`event-hooks.ts`](./examples/event-hooks.ts)             | Wiring observability events to your metrics stack |

---

## Documentation

- **[Architecture Specification](./ARCHITECTURE.md)** &mdash; Full type definitions, interfaces, data flow, and design rationale
- **[Development Plan](./DEV_PLAN.md)** &mdash; Sprint-by-sprint roadmap to v1.0
- **[Changelog](./CHANGELOG.md)** &mdash; Version history and release notes
- **[Contributing Guide](./CONTRIBUTING.md)** &mdash; Setup, coding standards, and PR process
- **[AGENTS.md](./AGENTS.md)** &mdash; Agent skill definitions for contributors using multi-agent workflows

Generated API docs: run `pnpm docs` to build with TypeDoc.

---

## Contributing

Contributions are welcome &mdash; whether it's a bug report, feature suggestion, or pull request. Areas where we especially need help:

- Additional compression strategies
- Transport implementations (WebSocket, gRPC)
- Performance benchmarks and optimization
- Security reviews
- Documentation and examples

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide.

---

## Roadmap

| Version | Focus                                                        |
| ------- | ------------------------------------------------------------ |
| v1.0    | Core handoff lifecycle (current)                             |
| v1.1    | Circuit breakers, dead letter queues, PII masking            |
| v1.2    | Multi-criteria routing policies, dynamic scoring             |
| v2.0    | Plugin architecture, multi-hop handoffs, WebSocket transport |

---

## License

MIT &mdash; see [LICENSE](./LICENSE).
