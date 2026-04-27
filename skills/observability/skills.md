# Observability Skill

## Description

Implements typed event-based observability for the Agent Handoff Protocol. The library does not bundle a metrics or logging stack; instead, it emits structured lifecycle events that users wire to their own observability tools (OpenTelemetry, Datadog, console, etc.).

## Capabilities

- Implement a lightweight typed event emitter (`TypedEventEmitter<HandoffEventMap>`)
- Define `HandoffEventMap` with all lifecycle events
- Emit events at every handoff stage: start, complete, reject, error
- Ensure zero runtime dependencies for observability
- Support correlation via `handoffId` and `sessionId`

## Triggers

- When implementing or modifying `src/utils/events.ts`
- When adding new event types to `HandoffManager` or `HandoffExecutor`
- When debugging production issues requiring trace data
- When optimizing event emission overhead

## Handoff Conditions

- Complex distributed tracing scenarios (span propagation)
- Security implications of logging (PII in events)
- Performance overhead concerns (high-frequency event emission)
- Cross-cutting observability needs (metrics aggregation)

## Dependencies

- `typescript-architecture` (for `HandoffEventMap` type definitions)
- `error-handling` (for `HandoffError` event payloads)
- `data-privacy` (for PII scrubbing in event data)

## Outputs

| Output            | Path                                               | Description                   |
| ----------------- | -------------------------------------------------- | ----------------------------- |
| TypedEventEmitter | `src/utils/events.ts`                              | Type-safe event emitter       |
| HandoffEventMap   | `src/types/messages.ts` (or `src/types/events.ts`) | Event type definitions        |
| Unit tests        | `tests/unit/utils/events.test.ts`                  | Subscription + emission tests |

## Quality Standards

### Implementation Checklist

- [ ] `TypedEventEmitter` uses a `Map<string, Set<Listener>>` internally
- [ ] `on(event, listener)` registers a listener; `off(event, listener)` removes it
- [ ] `emit(event, payload)` calls all registered listeners synchronously
- [ ] `once(event, listener)` registers a listener that auto-removes after one call
- [ ] All events include `handoffId` and `sessionId` for correlation
- [ ] Event emission must not throw if a listener throws; catch and continue
- [ ] No external event library (EventEmitter3, etc.) — keep it zero-dependency

### Event Types

```typescript
export interface HandoffEventMap {
  handoffStart: (event: { handoffId: string; sessionId: string; trigger: HandoffTrigger }) => void;
  handoffComplete: (event: {
    handoffId: string;
    duration: number;
    receivingAgent: AgentCapabilities;
    routingDecision: RoutingDecision;
  }) => void;
  handoffReject: (event: {
    handoffId: string;
    duration: number;
    reason?: string;
    routingDecision: RoutingDecision;
  }) => void;
  handoffError: (event: { handoffId: string; error: HandoffError }) => void;
}
```

### Test Requirements

- [ ] Test `on` + `emit` roundtrip for each event type
- [ ] Test `off` removes only the specified listener
- [ ] Test `once` auto-removes after emission
- [ ] Test multiple listeners for the same event
- [ ] Test that a throwing listener does not prevent other listeners from running
- [ ] Test that unsubscribing during emission does not crash

## Common Pitfalls

- **Do not** use Node.js `EventEmitter` directly. It is not tree-shakeable and bloats browser bundles. Use a minimal Map-based implementation.
- **Do not** emit events before the handoff ID is generated. Every event must be correlatable.
- **Do not** include raw `Message.content` or `UserMetadata` in event payloads without considering PII. Pass references (IDs) rather than full objects when possible.
- **Do not** make `emit` async. Listeners should be synchronous; if users need async observability, they can fire-and-forget inside their listener.
- **Do not** forget to emit `handoffError` when the executor catches an exception. It is the only signal users get for unexpected failures.

## Cross-References

- ARCHITECTURE.md § "Observability" → Event map and usage example
- ARCHITECTURE.md § "Handoff Executor" → Where events are emitted
- ARCHITECTURE.md § "Data Flow" → Event emission points in successful/rejection flows
