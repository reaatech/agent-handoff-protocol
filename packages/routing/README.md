# @reaatech/agent-handoff-routing

[![npm version](https://img.shields.io/npm/v/@reaatech/agent-handoff-routing.svg)](https://www.npmjs.com/package/@reaatech/agent-handoff-routing)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/agent-handoff-protocol/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/agent-handoff-protocol/ci.yml?branch=main&label=CI)](https://github.com/reaatech/agent-handoff-protocol/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Intelligent agent routing engine for selecting the best target agent during a handoff. Implements a weighted scoring algorithm with a route/clarify/fallback decision tree and an in-memory agent registry.

## Installation

```bash
npm install @reaatech/agent-handoff-routing
# or
pnpm add @reaatech/agent-handoff-routing
```

## Feature Overview

- **Weighted scoring algorithm** — skill match 40%, domain match 30%, load factor 20%, language match 10%
- **Three-part decision tree** — primary route, clarification when ambiguous, fallback when no match
- **Ambiguity detection** — triggers clarification when top two agents score within threshold
- **Agent registry** — in-memory `Map<string, AgentCapabilities>` with register/unregister/getAll
- **Compatibility filter** — excludes offline or overloaded agents before scoring
- **Pluggable** — implements `HandoffRouter` from `@reaatech/agent-handoff`

## Quick Start

```typescript
import { CapabilityBasedRouter, AgentRegistry } from '@reaatech/agent-handoff-routing';
import type { HandoffPayload, AgentCapabilities } from '@reaatech/agent-handoff';

const router = new CapabilityBasedRouter({
  minConfidenceThreshold: 0.7,
  ambiguityThreshold: 0.15,
  maxAlternatives: 3,
  policy: 'best_effort',
});

const registry = new AgentRegistry();
registry.register({
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

const decision = await router.route(payload, registry.getAll());
// decision.type: 'primary' | 'clarification' | 'fallback'
```

## Exports

### Router

| Export | Description |
|---|---|
| `CapabilityBasedRouter` | Weighted scoring router with configurable thresholds and policies |

#### Routing Policies

| Policy | Behavior |
|---|---|
| `strict` | Reject below `minConfidenceThreshold` — no best-effort fallthrough |
| `best_effort` | Route to highest-scoring agent even below threshold |
| `hierarchical` | Delegate to specialization sub-agents when available |

#### Scoring Formula

Each agent receives a weighted score (0–100):

```
score = (skillMatch × 0.4) + (domainMatch × 0.3) + (loadFactor × 0.2) + (languageMatch × 0.1)
```

- **Skill match**: Jaccard similarity between `requiredSkills` and agent's `skills`
- **Domain match**: Jaccard similarity between message context and agent's `domains`
- **Load factor**: `1 - (currentLoad / maxConcurrentSessions)`, scaled to 0–100
- **Language match**: 100 if user language matches agent, 50 for partial, 0 for no match

#### Decision Types

| Type | When |
|---|---|
| `primary` | Top agent exceeds confidence threshold and is not ambiguous with runner-up |
| `clarification` | Top two agents score within `ambiguityThreshold`; includes `candidateAgents` and `clarificationQuestions` |
| `fallback` | No agents available, all below threshold (strict mode), or all busy/offline |

### Agent Registry

| Method | Description |
|---|---|
| `register(capabilities)` | Add or update an agent's capabilities |
| `unregister(agentId)` | Remove an agent by ID |
| `get(agentId)` | Retrieve a single agent's capabilities |
| `getAll()` | Get all registered agents as an array |
| `has(agentId)` | Check if an agent is registered |
| `clear()` | Remove all agents |

## Related Packages

- [`@reaatech/agent-handoff`](https://www.npmjs.com/package/@reaatech/agent-handoff) — Core types, errors, utilities
- [`@reaatech/agent-handoff-compression`](https://www.npmjs.com/package/@reaatech/agent-handoff-compression) — Context compression strategies
- [`@reaatech/agent-handoff-protocol`](https://www.npmjs.com/package/@reaatech/agent-handoff-protocol) — Full orchestration layer

## License

[MIT](https://github.com/reaatech/agent-handoff-protocol/blob/main/LICENSE)
