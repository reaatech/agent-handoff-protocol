# Developer Experience Skill

## Description

Optimizes the public API surface, configuration ergonomics, and error messages. Ensures that developers can set up and use the library in under 5 minutes with sensible defaults and clear feedback.

## Capabilities

- Design intuitive `HandoffManager` and `createHandoffConfig` APIs
- Ensure all public APIs have JSDoc comments with examples
- Improve `HandoffError` messages for actionable debugging
- Design `DeepPartial<T>` and config merging for ergonomic overrides
- Validate that `package.json` exports map supports ESM + CJS + TypeScript

## Triggers

- When designing or modifying public APIs (`src/index.ts`, `src/core/`)
- When improving error messages or config validation
- When setting up build tooling (`tsup`, `package.json` exports)
- When writing examples or quick-start guides

## Handoff Conditions

- Complex UX decisions (breaking API changes)
- Needs user research (usability testing)
- Trade-offs with technical constraints (bundle size vs. DX)
- Tooling requirements (CLI, VS Code extension)

## Dependencies

- `typescript-architecture` (for API design and module exports)
- `technical-writing` (for documentation and examples)

## Outputs

| Output         | Path                 | Description                         |
| -------------- | -------------------- | ----------------------------------- |
| Public API     | `src/index.ts`       | Clean, tree-shakeable exports       |
| Config factory | `src/core/config.ts` | `createHandoffConfig` with defaults |
| Examples       | `examples/`          | Runnable quick-start examples       |
| package.json   | `package.json`       | Dual-format exports, engines        |

## Quality Standards

### API Design Checklist

- [ ] `HandoffManager` constructor accepts a single `HandoffConfig` object
- [ ] `createHandoffConfig(options?)` merges user options with `defaultHandoffConfig`
- [ ] All optional config properties are truly optional (no required nested objects)
- [ ] `HandoffError.message` is human-readable and actionable
- [ ] `HandoffResult` includes enough context for the caller to decide next steps
- [ ] `on`/`off` event API matches Node.js conventions for familiarity
- [ ] No `any` types in the public API surface

### package.json Requirements

```json
{
  "name": "@reaatech/agent-handoff-protocol",
  "type": "module",
  "sideEffects": false,
  "engines": { "node": ">=20.0.0" },
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  }
}
```

### Error Message Guidelines

| Scenario         | Bad                | Good                                                                              |
| ---------------- | ------------------ | --------------------------------------------------------------------------------- |
| Missing endpoint | `Error: undefined` | `TransportError: Agent 'billing-agent' has no A2A endpoint configured`            |
| Validation fail  | `Error: invalid`   | `ValidationError: Payload validation failed: handoffId must be <= 128 characters` |
| No transport     | `Error`            | `TransportError: No healthy transport available for agent 'billing-agent'`        |

### Example Requirements

- [ ] `examples/basic-handoff.ts` — minimal setup, single transport
- [ ] `examples/custom-compression.ts` — injecting a custom compressor
- [ ] `examples/custom-transport.ts` — implementing `TransportLayer`
- [ ] `examples/event-hooks.ts` — wiring observability events

## Common Pitfalls

- **Do not** require users to instantiate 5 different objects to do a handoff. The happy path is `new HandoffManager(config)` + `executeHandoff(context)`.
- **Do not** use generic error messages like "An error occurred". Always include context (agent IDs, handoff IDs).
- **Do not** export internal types in `src/index.ts`. Only export what a user needs.
- **Do not** forget to test the CJS build path. ESM-only libraries break many Node.js projects.
- **Do not** require `tsconfig.json` changes from users. The library should work with default `strict` settings.

## Cross-References

- ARCHITECTURE.md § "Public API Surface" → `HandoffManager`, `createHandoffConfig`
- ARCHITECTURE.md § "Configuration" → `HandoffConfig`, defaults
- DEV_PLAN.md § Sprint 4 → Documentation and examples
- README.md → Quick start example
