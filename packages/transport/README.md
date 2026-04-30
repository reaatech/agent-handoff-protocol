# @reaatech/agent-handoff-transport

[![npm version](https://img.shields.io/npm/v/@reaatech/agent-handoff-transport.svg)](https://www.npmjs.com/package/@reaatech/agent-handoff-transport)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/agent-handoff-protocol/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/agent-handoff-protocol/ci.yml?branch=main&label=CI)](https://github.com/reaatech/agent-handoff-protocol/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Transport layer implementations for delivering handoffs between agents. Includes MCP (tool-call-based), A2A (HTTP POST with retry), and a transport factory with health-check caching and priority-based auto-selection.

## Installation

```bash
npm install @reaatech/agent-handoff-transport
# or
pnpm add @reaatech/agent-handoff-transport
```

## Feature Overview

- **MCPTransport** — handoffs via MCP `accept_handoff` tool calls with connection validation via ping
- **A2ATransport** — handoffs via HTTP POST with exponential backoff retry and full jitter
- **TransportFactory** — priority-based auto-selection with 30-second TTL health cache
- **Pluggable clients** — inject your own `MCPClient` or `HttpClient` implementation
- **Payload limits** — 10 MB (MCP) and 50 MB (A2A) max payload enforcement
- **Snake-case mapping** — MCP transport converts camelCase payload to expected snake_case args

## Quick Start

```typescript
import {
  MCPTransport,
  A2ATransport,
  TransportFactory,
} from '@reaatech/agent-handoff-transport';

// MCP transport
const mcpTransport = new MCPTransport({
  async callTool(params) {
    return { accepted: true, responseCode: 200 };
  },
  async ping(serverId) { /* noop */ },
});

// A2A transport with auth
const a2aTransport = new A2ATransport({
  async get(url) { return { status: 200 }; },
  async post(url, body) { return { status: 200, data: body }; },
}, { authHeaders: { 'x-api-key': 'sk-abc123' } });

// Auto-select best transport
const factory = new TransportFactory([mcpTransport, a2aTransport]);
const transport = factory.getTransport(agentCapabilities);
// Returns highest-priority healthy transport for the agent
```

## Exports

### Transports

| Export | Priority | Protocol | Description |
|---|---|---|---|
| `MCPTransport` | 1 | MCP | Tool-call-based handoffs via `accept_handoff` |
| `A2ATransport` | 2 | HTTP | RESTful handoffs with retry and health checks |

### `MCPTransport`

```typescript
new MCPTransport(client: MCPClient)
```

#### `MCPClient` Interface

| Method | Description |
|---|---|
| `callTool(params)` | Invoke `accept_handoff` tool with snake_case payload |
| `ping(serverId)` | Validate connection to MCP server |

The transport converts `HandoffPayload` to snake_case MCP tool-call arguments and parses the response. Connection validation uses `ping`. Max payload: 10 MB.

### `A2ATransport`

```typescript
new A2ATransport(client: HttpClient, options?: A2ATransportOptions)
```

#### `HttpClient` Interface

| Method | Description |
|---|---|
| `get(url)` | Health check via GET `{endpoint}/health` |
| `post(url, body)` | Send handoff via POST `{endpoint}/handoffs` |

#### `A2ATransportOptions`

| Property | Type | Default | Description |
|---|---|---|---|
| `authHeaders` | `Record<string, string>` | `{}` | Custom headers added to all requests |

Uses `withRetry` from `@reaatech/agent-handoff` for network errors and 5xx responses. Exponential backoff with full jitter. Max payload: 50 MB.

### `TransportFactory`

```typescript
new TransportFactory(transports: TransportLayer[], healthTtlMs?: number)
```

| Method | Description |
|---|---|
| `getTransport(agent, preferred?)` | Select transport by user preference or auto-detect |
| `registerTransport(transport)` | Add a new transport layer |
| `unregisterTransport(name)` | Remove a transport by name |
| `checkHealth(agent)` | Pre-warm health cache for an agent |
| `getRegisteredTransports()` | List all registered transport names |

Auto-selection: returns the highest-priority transport whose `validateConnection` returns `true`. Health results are cached with a 30-second TTL. Pass `preferred: 'mcp'` or `preferred: 'a2a'` to override auto-selection.

## Related Packages

- [`@reaatech/agent-handoff`](https://www.npmjs.com/package/@reaatech/agent-handoff) — Core types, errors, `withRetry`
- [`@reaatech/agent-handoff-validation`](https://www.npmjs.com/package/@reaatech/agent-handoff-validation) — Payload validation used by the factory
- [`@reaatech/agent-handoff-protocol`](https://www.npmjs.com/package/@reaatech/agent-handoff-protocol) — Full orchestration layer

## License

[MIT](https://github.com/reaatech/agent-handoff-protocol/blob/main/LICENSE)
