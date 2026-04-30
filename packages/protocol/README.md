# @reaatech/agent-handoff-protocol

[![npm version](https://img.shields.io/npm/v/@reaatech/agent-handoff-protocol.svg)](https://www.npmjs.com/package/@reaatech/agent-handoff-protocol)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/agent-handoff-protocol/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/agent-handoff-protocol/ci.yml?branch=main&label=CI)](https://github.com/reaatech/agent-handoff-protocol/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

A small, opinionated TypeScript library for transferring conversations from one AI agent to another mid-session. Covers the full handoff lifecycle: context compression, intelligent routing, payload validation, transport delivery, and rejection handling with fallback.

## Installation

```bash
npm install @reaatech/agent-handoff-protocol
# or
pnpm add @reaatech/agent-handoff-protocol
```

This is the umbrella package that re-exports everything. For tree-shaking, install individual packages instead.

## Feature Overview

- **Context compression** — three strategies: hybrid (default), extractive summary, sliding window
- **Intelligent routing** — weighted scoring (skill 40%, domain 30%, load 20%, language 10%) with route/clarify/fallback decision tree
- **Payload validation** — Zod schemas (optional) or manual fallback with agent compatibility checks
- **Transport layer** — MCP (tool-call-based) and A2A (HTTP POST with retry), auto-selection with health caching
- **Rejection handling** — tries up to `maxAlternatives` alternative agents, returns typed `RejectionReason` on failure
- **7 error classes** — `HandoffError` hierarchy with typed error codes and contextual details
- **Typed lifecycle events** — `handoffStart`, `handoffComplete`, `handoffReject`, `handoffError`
- **Zero runtime dependencies** — everything is built-in or injected; `zod` is an optional peer
- **Dual ESM/CJS output** — works with `import` and `require`

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

// Build transport layer
const mcpTransport = new MCPTransport(mcpClient);
const transportFactory = new TransportFactory([mcpTransport]);

// Create configuration
const config = createHandoffConfig({
  routing: { minConfidenceThreshold: 0.6, policy: 'best_effort' },
});

// Wire up the manager
const manager = new HandoffManager(config, {
  router: new CapabilityBasedRouter(config.routing),
  compressor: new HybridCompressor(),
  transportFactory,
});

// Observe the lifecycle
manager.on('handoffStart', ({ handoffId, trigger }) => {
  console.log(`Handoff ${handoffId} started (${trigger.type})`);
});
manager.on('handoffComplete', ({ handoffId, duration, receivingAgent }) => {
  console.log(`Handoff ${handoffId} complete → ${receivingAgent.agentName} (${duration}ms)`);
});
manager.on('handoffReject', ({ handoffId, reason }) => {
  console.log(`Handoff ${handoffId} rejected: ${reason}`);
});
manager.on('handoffError', ({ handoffId, error }) => {
  console.error(`Handoff ${handoffId} failed: ${error.message}`);
});

// Register agents
manager.registerAgent({
  agentId: 'ts-agent',
  agentName: 'TypeScript Specialist',
  skills: ['typescript', 'architecture'],
  domains: ['frontend', 'backend'],
  maxConcurrentSessions: 5,
  currentLoad: 1,
  languages: ['en'],
  specializations: [],
  availability: 'available',
  version: '1.0.0',
});

// Execute a handoff
const result = await manager.executeHandoff({
  sessionId: 'session-123',
  conversationId: 'conv-456',
  messages: [
    { id: 'm1', role: 'user', content: 'How do I define a generic interface?', timestamp: new Date() },
    { id: 'm2', role: 'assistant', content: 'Use the `interface` keyword with type parameters.', timestamp: new Date() },
  ],
  trigger: {
    type: 'specialist_required',
    requiredSkills: ['typescript'],
    currentAgentSkills: [],
  },
  userMetadata: { userId: 'user-789', language: 'en' },
  state: { resolvedEntities: {}, openQuestions: [], contextVariables: {} },
  availableAgents: [],
});

console.log(result.success ? 'Accepted' : 'Rejected');
```

## Architecture

```
HandoffManager (public API)
  ├── ContextCompressor    compress conversation history → CompressedContext
  ├── HandoffRouter        score and select target agent → RoutingDecision
  ├── HandoffValidator     validate payload compatibility
  └── TransportLayer       deliver handoff (MCP or A2A)
```

### Handoff Lifecycle

```
compress → route → validate → transport → accept/reject → fallback (alternatives) → emit event
```

### Handoff Triggers

| Trigger | Fires when |
|---|---|
| `confidence_too_low` | Agent confidence drops below threshold |
| `topic_boundary_crossed` | Conversation topic changes significantly |
| `escalation_requested` | User or system requests escalation |
| `specialist_required` | Task requires skills the current agent lacks |
| `load_balancing` | Agent load exceeds threshold |

### Lifecycle Events

| Event | Fires |
|---|---|
| `handoffStart` | Handoff begins — includes handoffId, sessionId, trigger |
| `handoffComplete` | Target agent accepts — includes duration, receivingAgent, routingDecision |
| `handoffReject` | All agents rejected — includes reason, routingDecision |
| `handoffError` | Unexpected failure — includes the error object |

## Package Breakdown

This umbrella package re-exports everything. For finer-grained installs:

| Package | Purpose |
|---|---|
| [`@reaatech/agent-handoff`](https://www.npmjs.com/package/@reaatech/agent-handoff) | Core types, errors, utilities, config |
| [`@reaatech/agent-handoff-compression`](https://www.npmjs.com/package/@reaatech/agent-handoff-compression) | Context compression strategies |
| [`@reaatech/agent-handoff-routing`](https://www.npmjs.com/package/@reaatech/agent-handoff-routing) | Agent routing engine |
| [`@reaatech/agent-handoff-transport`](https://www.npmjs.com/package/@reaatech/agent-handoff-transport) | MCP + A2A transports |
| [`@reaatech/agent-handoff-validation`](https://www.npmjs.com/package/@reaatech/agent-handoff-validation) | Payload validation |

## Documentation

- [`ARCHITECTURE.md`](https://github.com/reaatech/agent-handoff-protocol/blob/main/ARCHITECTURE.md) — System design, package relationships, and data flows
- [`AGENTS.md`](https://github.com/reaatech/agent-handoff-protocol/blob/main/AGENTS.md) — Coding conventions and development guidelines
- [`CONTRIBUTING.md`](https://github.com/reaatech/agent-handoff-protocol/blob/main/CONTRIBUTING.md) — Contribution workflow and release process
- [`GITHUB_TO_NPM.md`](https://github.com/reaatech/agent-handoff-protocol/blob/main/GITHUB_TO_NPM.md) — npm publishing runbook

## License

[MIT](https://github.com/reaatech/agent-handoff-protocol/blob/main/LICENSE)
