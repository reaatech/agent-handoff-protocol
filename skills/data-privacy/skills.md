# Data Privacy Skill

## Description

Ensures GDPR-aligned data handling, PII detection, and masking capabilities. v1 provides an optional user-injected `maskPII` callback; advanced PII automation is post-v1.

## Capabilities

- Design optional PII masking hooks for compression and validation
- Ensure user data is not leaked in logs, events, or error messages
- Document data retention responsibilities (the library is stateless; users control retention)
- Review `HandoffPayload` for unnecessary data exposure

## Triggers

- When handling `userMetadata`, `Message.content`, or `ConversationState`
- When implementing compression that includes message content
- When designing event payloads for observability
- When reviewing error messages for PII leakage

## Handoff Conditions

- Complex legal requirements (jurisdiction-specific regulations)
- Cross-border data transfer issues
- Architecture-level privacy decisions (encryption at rest)
- Data breach scenarios (post-incident review)

## Dependencies

- `typescript-architecture` (for type definitions)
- `security-review` (for input validation and leak prevention)
- `context-compression` (for PII masking during summarization)

## Outputs

| Output                | Path                              | Description            |
| --------------------- | --------------------------------- | ---------------------- |
| PII masking interface | `src/types/payload.ts` (optional) | `MaskPIICallback` type |
| Privacy documentation | `README.md` / `ARCHITECTURE.md`   | Data handling notes    |

## Quality Standards

### Implementation Checklist

- [ ] `CompressionOptions` includes an optional `maskPII?: (text: string) => string` callback
- [ ] `SummaryCompressor` applies `maskPII` before generating summaries (if provided)
- [ ] `HandoffError.message` and `HandoffError.details` never contain raw `Message.content`
- [ ] Event payloads (`handoffComplete`, `handoffReject`) do not include `Message[]` or `UserMetadata`
- [ ] `HandoffPayload` includes only necessary fields; no gratuitous data collection

### PII Masking Interface

```typescript
export type MaskPIICallback = (text: string) => string;

export interface CompressionOptions {
  maxTokens: number;
  strategy: 'summary' | 'sliding_window' | 'hybrid';
  preserveRecentMessages?: number;
  maskPII?: MaskPIICallback; // user-injected
}
```

### Privacy Rules

1. **The library is stateless**. It does not persist handoff data. Users are responsible for data retention policies.
2. **No telemetry**. The library does not phone home.
3. **Opt-in masking**. PII detection is not built-in (would require heavy ML deps). Users provide a callback.
4. **Minimal exposure**. Only `handoffId`, `sessionId`, and agent IDs are emitted in events — never message content.

## Common Pitfalls

- **Do not** build PII detection into the library. It violates the zero-dependency policy and is domain-specific.
- **Do not** include `sessionHistory` or `compressedContext.summary` in event payloads. These may contain user data.
- **Do not** log full payloads in `TransportError.details`. Log agent IDs and handoff IDs only.
- **Do not** assume `maskPII` is provided. Always handle the undefined case gracefully.

## Cross-References

- ARCHITECTURE.md § "Security Considerations" → PII masking
- ARCHITECTURE.md § "Observability" → Event payload design
- ARCHITECTURE.md § "Context Compression Engine" → `CompressionOptions`
- DEV_PLAN.md § "Out of Scope" → Advanced PII detection / GDPR automation
