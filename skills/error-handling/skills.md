# Error Handling Skill

## Description

Designs comprehensive error handling, recovery strategies, and resilience patterns for the Agent Handoff Protocol.

## Capabilities

- Design typed error hierarchies (`HandoffError` and subclasses)
- Implement retry policies with exponential backoff and jitter
- Handle graceful degradation (fallback routes, degraded compression)
- Design fallback strategies for transport and routing failures
- Classify errors as retryable vs. non-retryable

## Triggers

- When implementing error handling in any module
- When designing recovery strategies for transport failures
- When adding resilience patterns (retry, fallback)
- When classifying rejection reasons from receiving agents
- When defining timeout behavior

## Handoff Conditions

- Complex distributed error scenarios (multi-transport, multi-agent)
- Needs security implications review (e.g., error messages leaking PII)
- Performance impact assessment required (retry storms, excessive latency)
- Circuit breaker design (post-v1 feature)
- Dead letter queue design (post-v1 feature)

## Dependencies

- `typescript-architecture` (for error type definitions)
- `observability` (for error event emission)

## Outputs

- Error type definitions and subclasses
- Retry utility implementations
- Error classification logic
- Fallback execution paths
- Event emissions for error tracking

## Quality Standards

### Error Hierarchy

```
HandoffError (base)
├── TransportError
├── ValidationError
├── TimeoutError
├── RejectionError
├── RoutingError
├── CompressionError
└── ConfigurationError
```

All errors must:

- Extend `HandoffError`
- Have a readonly `code` property from `HandoffErrorCode`
- Include a `details` record for structured logging
- Have a descriptive but safe message (no PII in `message`)

### Retry Policy

```typescript
interface RetryOptions {
  maxRetries: number; // default: 3
  backoff: 'linear' | 'exponential';
  baseDelayMs: number; // default: 100
  maxDelayMs: number; // default: 10000
  shouldRetry: (error: unknown) => boolean;
}
```

**Retryable errors** (transient):

- Network timeouts
- HTTP 5xx responses
- Connection refused (agent may be restarting)

**Non-retryable errors** (permanent):

- HTTP 4xx client errors (bad request, unauthorized)
- Validation failures
- Rejection by target agent (explicit `accepted: false`)

### Exponential Backoff with Jitter

Use full jitter to prevent thundering herd:

```typescript
function calculateDelay(attempt: number, options: RetryOptions): number {
  const exponential = options.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, options.maxDelayMs);
  return Math.random() * capped; // full jitter
}
```

### Timeout Handling

- Default transport timeout: **30 seconds**
- Default validation timeout: **5 seconds**
- Default compression timeout: **10 seconds**
- Timeouts must throw `TimeoutError` with the configured timeout value in `details`

### Post-v1 Patterns (Do Not Implement in v1)

These are noted for future releases. If asked to implement them in v1, escalate:

- **Circuit Breaker**: Track failure rates per transport and short-circuit after a threshold.
- **Dead Letter Queue**: Persist failed handoffs for later replay.
- **Bulkhead Isolation**: Separate thread pools per transport.

## Common Pitfalls

- **Do not** catch errors silently. Always re-throw, emit an event, or return a `HandoffResult` with `success: false`.
- **Do not** retry on 4xx HTTP errors. Retry only on network failures and 5xx.
- **Do not** expose stack traces or internal details in `HandoffError.message` when the error may cross agent boundaries.
- **Do not** use `any` in catch clauses. Use `unknown` and narrow with `instanceof HandoffError`.
