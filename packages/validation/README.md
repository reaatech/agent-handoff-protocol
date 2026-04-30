# @reaatech/agent-handoff-validation

[![npm version](https://img.shields.io/npm/v/@reaatech/agent-handoff-validation.svg)](https://www.npmjs.com/package/@reaatech/agent-handoff-validation)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/agent-handoff-protocol/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/agent-handoff-protocol/ci.yml?branch=main&label=CI)](https://github.com/reaatech/agent-handoff-protocol/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Payload validation and agent compatibility checking for the Agent Handoff Protocol. Works with or without Zod — lazily loads Zod schemas if available, falls back to manual validation otherwise.

## Installation

```bash
npm install @reaatech/agent-handoff-validation
# or
pnpm add @reaatech/agent-handoff-validation
```

With Zod (optional, for stricter validation):

```bash
npm install @reaatech/agent-handoff-validation zod
```

## Feature Overview

- **Schema validation** — validates `HandoffPayload` structure against the protocol shape
- **Agent compatibility** — checks language support, capacity, availability, and history size
- **Zod support (optional)** — complete Zod schemas for `HandoffPayload` and `AgentCapabilities`; lazily loaded
- **Manual fallback** — identical validation without Zod — no peer dependency required
- **Rejection classification** — categorizes failures into 6 typed reasons: `capability_mismatch`, `overloaded`, `invalid_payload`, `timeout`, `unavailable`, `unknown`

## Quick Start

```typescript
import { HandoffValidator } from '@reaatech/agent-handoff-validation';

const validator = new HandoffValidator();

const result = await validator.validatePayload(payload, agentCapabilities);

if (!result.isValid) {
  console.error('Validation errors:', result.errors);
}
```

## Exports

### `HandoffValidator`

```typescript
new HandoffValidator()
```

| Method | Description |
|---|---|
| `validatePayload(payload, agent)` | Full validation: schema structure + compatibility checks |

Returns `{ isValid: boolean; errors: string[] }`. Validates: payload schema (zod or manual), language compatibility, agent capacity, availability status, and conversation history size.

### Manual Validation (no Zod required)

| Export | Description |
|---|---|
| `validatePayloadManual(payload, agent?)` | Schema-only validation of `HandoffPayload` structure |
| `validateAgentCapabilitiesManual(capabilities)` | Validate an `AgentCapabilities` object standalone |
| `validateCompatibilityManual(payload, agent)` | Compatibility checks: language, load, availability |

### Rejection Classification

| Export | Description |
|---|---|
| `classifyRejectionReason(message, statusCode?)` | Map HTTP responses and error messages to a `RejectionReason` |
| `RejectionReason` | Type: `'capability_mismatch' \| 'overloaded' \| 'invalid_payload' \| 'timeout' \| 'unavailable' \| 'unknown'` |

### Zod Integration (optional)

| Export | Description |
|---|---|
| `createZodValidator()` | Returns a validator function using Zod schemas (requires `zod` installed) |

The Zod schemas are lazily loaded: `HandoffValidator` tries `import('zod')` on construction. If Zod is available, validation uses the full schema with detailed error messages. If not, it falls back to manual validation — **identical API, identical behavior**.

## Related Packages

- [`@reaatech/agent-handoff`](https://www.npmjs.com/package/@reaatech/agent-handoff) — Core types (`HandoffPayload`, `AgentCapabilities`)
- [`@reaatech/agent-handoff-transport`](https://www.npmjs.com/package/@reaatech/agent-handoff-transport) — Uses validation for compatibility checks before transport
- [`@reaatech/agent-handoff-protocol`](https://www.npmjs.com/package/@reaatech/agent-handoff-protocol) — Full orchestration layer

## License

[MIT](https://github.com/reaatech/agent-handoff-protocol/blob/main/LICENSE)
