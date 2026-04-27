# Transport Factory Skill

## Description

Manages transport layer abstraction, selection, and health-check-based failover. The `TransportFactory` decides which transport (MCP or A2A) to use for a given target agent and can cache health-check results with TTL.

## Capabilities

- Implement `TransportFactory` with auto-detection and manual override
- Maintain a registry of available transports
- Perform lightweight health checks before selecting a transport
- Support `preferredTransport` override (`'mcp' | 'a2a' | 'auto'`)
- Cache health check results to avoid redundant pings

## Triggers

- When implementing or modifying `src/transport/transport-factory.ts`
- When adding a new transport type (post-v1: WebSocket)
- When implementing failover logic
- When optimizing transport selection latency

## Handoff Conditions

- Complex multi-transport scenarios (agent supports both MCP and A2A)
- Needs architecture review (changes to `TransportLayer` interface)
- Performance regression detected in selection path
- Transport compatibility issues between source and target

## Dependencies

- `typescript-architecture` (for `TransportLayer` interface)
- `mcp-integration` (for MCP transport registration)
- `a2a-integration` (for A2A transport registration)
- `error-handling` (for `TransportError` when no transport is available)

## Outputs

| Output                   | Path                                             | Description                |
| ------------------------ | ------------------------------------------------ | -------------------------- |
| TransportFactory         | `src/transport/transport-factory.ts`             | Factory implementation     |
| TransportLayer interface | `src/transport/transport-layer.ts`               | Core transport contract    |
| Unit tests               | `tests/unit/transport/transport-factory.test.ts` | Selection + failover tests |

## Quality Standards

### Implementation Checklist

- [ ] `TransportFactory` constructor accepts `TransportLayer[]` (injected transports)
- [ ] `getTransport(agent, preferred?)` returns the best available `TransportLayer`
- [ ] Selection order when `preferred = 'auto'`:
  1. If `preferred` is specified and transport is healthy, use it
  2. Otherwise, pick the transport with highest `priority` whose `validateConnection` returns `true`
  3. If no transport is healthy, throw `TransportError`
- [ ] Health check results are cached with a configurable TTL (default: 30s)
- [ ] `registerTransport(transport)` and `unregisterTransport(name)` allow dynamic modification
- [ ] `getTransport` must complete in **<5ms** when health results are cached

### Auto-Detection Logic

```typescript
// Pseudocode for transport selection
function selectTransport(agent, preferred) {
  const candidates = this.transports
    .filter((t) => preferred === 'auto' || t.name === preferred)
    .sort((a, b) => b.priority - a.priority);

  for (const transport of candidates) {
    if (this.isHealthy(agent.agentId, transport.name)) {
      return transport;
    }
  }
  throw new TransportError('No healthy transport available for agent', { agentId: agent.agentId });
}
```

### Test Requirements

- [ ] Test `getTransport` returns MCP when both are available (higher priority)
- [ ] Test `getTransport` returns A2A when MCP health check fails
- [ ] Test `getTransport` throws when all transports fail health check
- [ ] Test `preferredTransport` override (`'mcp'`, `'a2a'`)
- [ ] Test health check TTL caching (no re-ping within TTL)
- [ ] Test dynamic `registerTransport` / `unregisterTransport`

## Common Pitfalls

- **Do not** perform synchronous health checks in `getTransport` without caching. That adds unacceptable latency to every handoff.
- **Do not** mutate the injected transports array. Use an internal registry copy.
- **Do not** fallback to an unhealthy transport silently. Always throw so the caller can handle it explicitly.
- **Do not** hardcode transport names (`'mcp'`, `'a2a'`) as magic strings throughout the codebase. Use constants or enums (literal unions) defined in `src/types/transport.ts`.
- **Do not** implement circuit breaker logic in v1. It is explicitly post-v1.

## Cross-References

- ARCHITECTURE.md § "Transport Layers" → TransportFactory
- ARCHITECTURE.md § "Transport Interface" → `TransportLayer`, `TransportCapabilities`
- ARCHITECTURE.md § "High-Level Architecture" → Transport Layer diagram
- DEV_PLAN.md § Sprint 3 → Transport & Execution
