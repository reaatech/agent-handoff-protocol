# Testing Strategy Skill

## Description

Designs and implements comprehensive testing strategies across all layers to ensure quality and reliability of the Agent Handoff Protocol.

## Capabilities

- Design unit test suites with Vitest
- Implement integration tests for end-to-end handoff flows
- Create performance benchmarks for compression and routing
- Generate test fixtures and mock data
- Ensure test coverage >95%
- Implement test automation in CI/CD

## Triggers

- When implementing new features
- When refactoring existing code
- When performance regression detected
- When adding critical functionality
- When preparing for release
- When a PR touches `src/` without corresponding tests

## Handoff Conditions

- Complex test scenarios requiring domain expertise (transport mocking, LLM stubbing)
- Performance testing requirements (load, latency, memory)
- Security testing needs (fuzzing, input validation)
- Test infrastructure limitations (CI flakiness, slow tests)
- Chaos testing design (post-v1)

## Dependencies

- `typescript-architecture` (for understanding module structure)
- All other skills (for domain-specific testing)

## Outputs

- Test suites (unit, integration)
- Test coverage reports
- Performance benchmarks
- Test fixtures and mock factories
- Testing documentation

## Quality Standards

### Test Directory Layout

Mirror the `src/` structure in `tests/unit/`:

```
tests/
├── unit/
│   ├── compression/
│   │   ├── hybrid-compressor.test.ts
│   │   ├── sliding-window-compressor.test.ts
│   │   └── token-counter.test.ts
│   ├── routing/
│   │   ├── capability-based-router.test.ts
│   │   └── agent-registry.test.ts
│   ├── transport/
│   │   ├── mcp-transport.test.ts
│   │   ├── a2a-transport.test.ts
│   │   └── transport-factory.test.ts
│   └── core/
│       ├── handoff-manager.test.ts
│       ├── handoff-executor.test.ts
│       └── config.test.ts
├── integration/
│   ├── mcp-handoff-flow.test.ts
│   ├── a2a-handoff-flow.test.ts
│   └── rejection-fallback.test.ts
└── fixtures/
    ├── messages.ts
    ├── agents.ts
    └── payloads.ts
```

### Unit Test Standards

- Every public function has at least one test
- Test the happy path, edge cases, and error paths
- Use descriptive test names: `it('returns FallbackRoute when no agents match', ...)`
- Mock external dependencies (HTTP clients, MCP SDK)
- Keep unit tests fast: target <100ms per test file

### Integration Test Standards

- Test full handoff flows with mocked transports
- Verify event emissions at each lifecycle stage
- Test timeout and retry behavior with fake timers (`vi.useFakeTimers()`)
- Do not call real network services in CI

### Mocking Strategy

#### Transport Mocking

```typescript
// tests/mocks/transport.ts
export function createMockTransport(overrides?: Partial<TransportLayer>): TransportLayer {
  return {
    name: 'mock',
    priority: 0,
    sendHandoff: vi.fn().mockResolvedValue({
      accepted: true,
      responseCode: 200,
      timestamp: new Date(),
    }),
    validateConnection: vi.fn().mockResolvedValue(true),
    getCapabilities: vi.fn().mockReturnValue({
      supportsStreaming: false,
      supportsCompression: true,
      maxPayloadSizeBytes: 1024 * 1024,
      protocols: ['mock'],
    }),
    ...overrides,
  };
}
```

#### Agent Fixture

```typescript
// tests/fixtures/agents.ts
export const createAgentFixture = (overrides?: Partial<AgentCapabilities>): AgentCapabilities => ({
  agentId: 'agent-1',
  agentName: 'Test Agent',
  skills: ['typescript', 'architecture'],
  domains: ['development'],
  maxConcurrentSessions: 10,
  currentLoad: 2,
  languages: ['en'],
  specializations: [{ domain: 'development', proficiencyLevel: 0.9, minConfidenceThreshold: 0.7 }],
  availability: 'available',
  version: '1.0.0',
  ...overrides,
});
```

### Coverage Enforcement

- **Target**: >95% line coverage
- **CI gate**: PRs cannot merge if coverage drops below 95%
- **Exclusions**: `src/utils/events.ts` (thin wrapper, hard to test meaningfully) may be excluded with justification

Run coverage locally:

```bash
pnpm test --coverage
```

### Performance Benchmarks

Use Vitest bench for performance tests:

```typescript
import { bench, describe } from 'vitest';
import { HybridCompressor } from '../../src/compression';
import { createLargeMessageHistory } from '../fixtures/messages';

describe('compression performance', () => {
  const compressor = new HybridCompressor();

  bench('compress 100 messages', async () => {
    const messages = createLargeMessageHistory(100);
    await compressor.compress(messages, { maxTokens: 2000, strategy: 'hybrid' });
  });

  bench('compress 1000 messages', async () => {
    const messages = createLargeMessageHistory(1000);
    await compressor.compress(messages, { maxTokens: 2000, strategy: 'hybrid' });
  });
});
```

## Common Pitfalls

- **Do not** test implementation details (e.g., private method calls). Test public behavior and outputs.
- **Do not** share mutable state between tests. Each test should create its own fixtures.
- **Do not** skip tests without a TODO comment linking to an issue.
- **Do not** use `setTimeout` / `setInterval` in tests. Use `vi.useFakeTimers()` for time-based logic.
