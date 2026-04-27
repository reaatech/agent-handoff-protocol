# A2A Integration Skill

## Description

Implements the A2A (Agent-to-Agent) transport layer using HTTP POST request/response. A2A is the secondary transport (priority 2) for agents that expose an HTTP endpoint. WebSocket support is explicitly out of scope for v1.

## Capabilities

- Implement `A2ATransport` class conforming to `TransportLayer`
- POST `HandoffRequest` to `{agentEndpoint}/handoffs`
- Retry with exponential backoff on transient network errors (not 4xx)
- Parse HTTP responses into `HandoffResponse`
- Validate connections via `{endpoint}/health`
- Accept injectable `HttpClient` for connection pooling and testing

## Triggers

- When implementing or modifying `src/transport/a2a-transport.ts`
- When designing API contracts for A2A handoffs
- When handling network failure scenarios
- When adding retry or timeout behavior

## Handoff Conditions

- Security vulnerabilities detected (auth header leakage, MITM)
- Performance optimization needed (connection pooling, keep-alive)
- Protocol standardization required (A2A spec changes)
- Complex networking scenarios (proxies, custom TLS)

## Dependencies

- `typescript-architecture` (for `TransportLayer` interface and types)
- `transport-factory` (for auto-selection integration)
- `error-handling` (for retry logic and `TransportError`)
- `security-review` (for HTTPS enforcement and auth handling)

## Outputs

| Output               | Path                                         | Description                        |
| -------------------- | -------------------------------------------- | ---------------------------------- |
| A2ATransport         | `src/transport/a2a-transport.ts`             | Transport implementation           |
| HttpClient interface | `src/transport/a2a-transport.ts`             | Injectable HTTP client abstraction |
| Unit tests           | `tests/unit/transport/a2a-transport.test.ts` | Mock HTTP client tests             |

## Quality Standards

### Implementation Checklist

- [ ] `A2ATransport` implements `TransportLayer` with `name = 'a2a'` and `priority = 2`
- [ ] Constructor accepts `(httpClient: HttpClient, authHeaders?: Record<string, string>)`
- [ ] `sendHandoff` constructs URL as `{endpoint}/handoffs` where `endpoint` comes from `agent.metadata?.endpoint`
- [ ] Request body omits internal fields; sends: `payload`, `sourceAgent`, `requireExplicitAcceptance`, `timestamp` (ISO string)
- [ ] Retry only on network errors and HTTP 5xx; **never** retry on 4xx
- [ ] `validateConnection` performs GET `{endpoint}/health` with 5s timeout
- [ ] `getCapabilities` returns `supportsStreaming: false`, `supportsCompression: true`, `maxPayloadSizeBytes: 50MB`, `protocols: ['https', 'http']`
- [ ] Throws `TransportError` if `agent.metadata?.endpoint` is missing or invalid

### HttpClient Interface

```typescript
export interface HttpClient {
  get<T>(
    url: string,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<{ data: T }>;
  post<T>(
    url: string,
    body: unknown,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<{ data: T }>;
}
```

### Test Requirements

- [ ] Mock `HttpClient` with `get` and `post` methods
- [ ] Test successful handoff via POST
- [ ] Test handoff rejection (HTTP 200 with `accepted: false`)
- [ ] Test retry on HTTP 502/503 (up to 3 retries)
- [ ] Test **no retry** on HTTP 400/404
- [ ] Test timeout handling
- [ ] Test missing endpoint error
- [ ] Test health check success/failure

## Common Pitfalls

- **Do not** use `fetch` directly. Require an injectable `HttpClient` so users can provide `axios`, `undici`, or a mock.
- **Do not** retry on 4xx errors. A 400 means the payload is bad; retrying wastes resources.
- **Do not** construct the full `HandoffRequest` object in the POST body. The A2A receiver only needs the payload and a few metadata fields. Sending the full internal `HandoffRequest` leaks routing internals.
- **Do not** ignore the `agent.metadata?.endpoint` type. Validate it's a string starting with `http://` or `https://`.
- **Do not** implement WebSocket fallback in v1. It is explicitly post-v1.

## Cross-References

- ARCHITECTURE.md § "Transport Layers" → A2A Transport
- ARCHITECTURE.md § "Transport Interface" → `TransportLayer`, `TransportCapabilities`
- ARCHITECTURE.md § "Error Handling" → `TransportError`, retry utility
- DEV_PLAN.md § "Out of Scope" → WebSocket transport
