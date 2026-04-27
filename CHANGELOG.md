# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-24

### Added

- **Core type system** — `HandoffTrigger`, `HandoffPayload`, `HandoffRequest`, `HandoffResponse`, `AgentCapabilities`, `RoutingDecision`, and supporting types
- **Context compression engine** with three strategies:
  - `SummaryCompressor` — extractive summarization
  - `SlidingWindowCompressor` — token-budget recency filter
  - `HybridCompressor` — sliding window + summary + key facts + entity/intent/open-item extraction
- **Route/clarify/fallback decision tree** via `CapabilityBasedRouter` with weighted scoring (skill 40%, domain 30%, load 20%, language 10%)
- **MCP transport layer** — tool-call-based handoffs with `accept_handoff` convention
- **A2A transport layer** — HTTP POST to `{endpoint}/handoffs` with retry, health checks, and auth header support
- **Transport factory** — auto-selection by priority, health cache with TTL, preferred transport override
- **Handoff executor** — full lifecycle orchestration (compress → build payload → route → validate → transport → handle rejection/fallback)
- **Handoff manager** — public API entry point with typed event hooks (`handoffStart`, `handoffComplete`, `handoffReject`, `handoffError`)
- **Payload validation** — manual fallback + optional `zod` peer dependency with lazy loading
- **Retry utility** — exponential backoff with full jitter, configurable `shouldRetry` predicate
- **Error hierarchy** — `HandoffError`, `TransportError`, `ValidationError`, `TimeoutError`, `RejectionError`, `RoutingError`, `CompressionError`, `ConfigurationError`
- **Comprehensive test suite** — 200 tests across unit, integration, and benchmark suites with >95% coverage
- **Examples** — basic setup, custom compressor, custom transport, and event hook usage

### Design Decisions

- **Zero runtime dependencies** — everything is built-in or injected by the user
- **Optional `zod` peer dependency** — validation works without it via manual fallback
- **ESM primary + CJS fallback** — dual format via `tsup`
- **Strict TypeScript** — `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, no `any` in public API
