# agent-handoff-protocol

[![CI](https://github.com/reaatech/agent-handoff-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/reaatech/agent-handoff-protocol/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)

> A minimal, transport-agnostic TypeScript library for transferring conversations from one AI agent to another mid-session — with intelligent routing, context compression, and graceful rejection handling.

This monorepo provides the full handoff lifecycle: compress conversation history, score and select the best target agent, validate payload compatibility, deliver via MCP or A2A transport, and handle rejection with fallback alternatives.

## Features

- **Context compression** — Three strategies: hybrid (sliding window + summary + key facts + entities + intents), extractive summary, and sliding window. Configurable token budgets. Pluggable token counters.
- **Intelligent routing** — Weighted scoring algorithm (skill 40%, domain 30%, load 20%, language 10%) with a route/clarify/fallback decision tree. Three routing policies: strict, best-effort, hierarchical.
- **Payload validation** — Zod schemas (optional) or manual validation fallback. Checks schema structure, language compatibility, agent capacity, and availability.
- **Transport layer** — MCP transport (tool-call-based `accept_handoff`) and A2A transport (HTTP POST with exponential backoff retry). Transport factory with priority-based auto-selection and health-check caching.
- **Rejection handling** — Tries up to `maxAlternatives` alternative agents before returning a typed `RejectionReason`.
- **Error hierarchy** — 7 typed error classes extending `HandoffError` with error codes and contextual details.
- **Observability** — Typed lifecycle events (`handoffStart`, `handoffComplete`, `handoffReject`, `handoffError`) wireable to any logging, metrics, or tracing stack.
- **Zero runtime dependencies** — Everything is built-in or injected by the consumer. `zod` is an optional peer dependency.
- **Dual ESM/CJS** — Every package ships both `import` and `require`-compatible builds.

## Installation

### Using the packages

Packages are published under the `@reaatech` scope and can be installed individually:

```bash
# Full orchestration layer (re-exports everything)
pnpm add @reaatech/agent-handoff-protocol

# Core types, utilities, and configuration
pnpm add @reaatech/agent-handoff

# Context compression strategies
pnpm add @reaatech/agent-handoff-compression

# Agent routing engine
pnpm add @reaatech/agent-handoff-routing

# MCP and A2A transport layers
pnpm add @reaatech/agent-handoff-transport

# Payload validation
pnpm add @reaatech/agent-handoff-validation
```

### Contributing

```bash
# Clone the repository
git clone https://github.com/reaatech/agent-handoff-protocol.git
cd agent-handoff-protocol

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the test suite
pnpm test

# Run linting
pnpm lint
```

## Quick Start

Wire up a `HandoffManager` with the default compressor, router, and MCP transport:

```typescript
import {
  HandoffManager,
  createHandoffConfig,
  HybridCompressor,
  CapabilityBasedRouter,
  TransportFactory,
  MCPTransport,
} from '@reaatech/agent-handoff-protocol';

// Build transport
const mcpTransport = new MCPTransport(mcpClient);
const transportFactory = new TransportFactory([mcpTransport]);

// Create config with sensible defaults
const config = createHandoffConfig({
  routing: { minConfidenceThreshold: 0.6, policy: 'best_effort' },
});

// Wire up
const manager = new HandoffManager(config, {
  router: new CapabilityBasedRouter(config.routing),
  compressor: new HybridCompressor(),
  transportFactory,
});

// Observe
manager.on('handoffComplete', ({ handoffId, duration, receivingAgent }) => {
  console.log(`Handoff ${handoffId} → ${receivingAgent.agentName} (${duration}ms)`);
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

// Execute
const result = await manager.executeHandoff({
  sessionId: 'session-123',
  conversationId: 'conv-456',
  messages: [
    { id: 'm1', role: 'user', content: 'How do I define a generic interface?', timestamp: new Date() },
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

See the [`examples/`](./examples/) directory for working samples including custom compressors, custom transports, and lifecycle event wiring.

## Packages

| Package | Description |
|---|---|
| [`@reaatech/agent-handoff`](./packages/core) | Core types, utilities, error classes, and configuration |
| [`@reaatech/agent-handoff-compression`](./packages/compression) | Context compression strategies (hybrid, summary, sliding window) |
| [`@reaatech/agent-handoff-routing`](./packages/routing) | Intelligent agent routing engine with weighted scoring |
| [`@reaatech/agent-handoff-transport`](./packages/transport) | MCP and A2A transport layers with health-checked factory |
| [`@reaatech/agent-handoff-validation`](./packages/validation) | Payload validation with Zod (optional) or manual fallback |
| [`@reaatech/agent-handoff-protocol`](./packages/protocol) | Full orchestration layer — re-exports everything |

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System design, package relationships, and data flows
- [`AGENTS.md`](./AGENTS.md) — Coding conventions and development guidelines
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Contribution workflow and release process
- [`GITHUB_TO_NPM.md`](./GITHUB_TO_NPM.md) — npm publishing runbook

## License

[MIT](LICENSE)
