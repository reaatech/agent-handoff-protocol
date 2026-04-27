# Security Review Skill

## Description

Ensures security best practices across the Agent Handoff Protocol. This skill is triggered as a mandatory gate before any release and whenever code handles sensitive data, authentication, or transport-layer security.

## Capabilities

- Review code for security vulnerabilities (injection, leakage, deserialization risks)
- Validate input sanitization in `HandoffPayload`, `Message`, and `AgentCapabilities`
- Ensure HTTPS-by-default in A2A transport
- Verify that `HandoffError` messages do not leak PII or stack traces across agent boundaries
- Audit event payloads for sensitive data exposure

## Triggers

- Before any release (mandatory gate)
- When handling sensitive data (`userMetadata`, `Message.content`)
- When implementing authentication or transport security
- When adding new external inputs (file uploads, environment variables)
- When a PR touches `src/transport/`, `src/validation/`, or `src/utils/errors.ts`

## Handoff Conditions

- Complex security scenarios (custom auth schemes, mTLS)
- Needs legal/compliance review (GDPR, HIPAA, SOC2)
- Architecture-level security decisions (encryption at rest)
- Cross-cutting security concerns (affecting multiple skills)

## Dependencies

- `typescript-architecture` (for code review scope)
- `data-privacy` (for PII handling validation)
- `a2a-integration` and `mcp-integration` (for transport security)

## Outputs

| Output                    | Path                        | Description                   |
| ------------------------- | --------------------------- | ----------------------------- |
| Security audit report     | N/A (review artifact)       | Written findings per release  |
| Input validation rules    | `src/validation/schemas.ts` | Zod/manual validation schemas |
| Hardening recommendations | N/A (review artifact)       | PR comments or issue tickets  |

## Quality Standards

### Review Checklist

- [ ] No `eval`, `new Function`, or dynamic code execution
- [ ] No prototype pollution vectors in object merges (`Object.assign`, spread)
- [ ] All external inputs validated before use (`HandoffPayload`, `AgentCapabilities`, HTTP bodies)
- [ ] `HandoffError.message` contains no PII, stack traces, or internal paths when crossing agent boundaries
- [ ] A2A transport defaults to HTTPS; HTTP only allowed in `development` mode (warn)
- [ ] MCP transport relies on SDK auth; no custom token handling in v1
- [ ] Event payloads do not include raw message content or user PII
- [ ] `maxPayloadSizeBytes` enforced before transport send
- [ ] Timeout values prevent resource exhaustion (not unbounded)

### Input Validation Requirements

```typescript
// Example validation rules that must be enforced
const handoffId = payload.handoffId;
if (!handoffId || typeof handoffId !== 'string' || handoffId.length > 128) {
  throw new ValidationError('Invalid handoffId', [
    'handoffId must be a non-empty string <= 128 chars',
  ]);
}

const endpoint = agent.metadata?.endpoint;
if (endpoint && !endpoint.startsWith('https://') && process.env.NODE_ENV !== 'development') {
  throw new ValidationError('Insecure endpoint', ['A2A endpoints must use HTTPS in production']);
}
```

### Test Requirements

- [ ] Fuzz-style tests for oversized payloads
- [ ] Validation tests for malformed `AgentCapabilities`
- [ ] Tests ensuring `HandoffError.message` is sanitized
- [ ] Tests ensuring HTTPS enforcement in production

## Common Pitfalls

- **Do not** trust `AgentCapabilities` from external registries without validation. A malicious agent could inject a large payload or an invalid endpoint.
- **Do not** include `Error.stack` in `HandoffError.details` when the error may be sent to another agent. Log stacks locally; send safe messages remotely.
- **Do not** use `Object.assign` with untrusted objects. Use explicit property assignment or Zod parsing.
- **Do not** ignore the `maxPayloadSizeBytes` capability. Validate payload size before transport send to avoid DoS.
- **Do not** implement custom cryptography in v1. Rely on TLS (HTTPS) and the MCP SDK's auth.

## Cross-References

- ARCHITECTURE.md § "Security Considerations"
- ARCHITECTURE.md § "Error Handling" → `HandoffError`, `ValidationError`
- ARCHITECTURE.md § "Transport Layers" → A2A HTTPS, MCP SDK auth
- DEV_PLAN.md § "Out of Scope" → Rate limiting, advanced encryption
