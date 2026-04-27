# Performance Optimization Skill

## Description

Optimizes latency, bundle size, and memory usage. This skill is triggered when benchmarks regress or when profiling identifies hot paths in compression, routing, or transport.

## Capabilities

- Profile and optimize hot paths in `HandoffExecutor`, routers, and compressors
- Ensure bundle size stays under 30KB gzipped
- Optimize memory usage (no unbounded history loading)
- Reduce routing decision latency (<50ms p95 for small histories)
- Validate that event emission and health checks do not block the main thread

## Triggers

- When performance regression detected in CI benchmarks
- When optimizing for production (bundle size, memory)
- When scaling to handle load (concurrent handoffs)
- When profiling reveals hot paths

## Handoff Conditions

- Complex performance bottlenecks requiring algorithmic changes
- Needs architecture-level changes (module restructuring)
- Trade-offs with other quality attributes (readability vs. speed)
- Hardware-specific optimizations (WASM, workers)

## Dependencies

- `typescript-architecture` (for module structure and tree-shaking)
- All other skills (for domain-specific optimization)

## Outputs

| Output              | Path                          | Description                    |
| ------------------- | ----------------------------- | ------------------------------ |
| Benchmark suite     | `tests/benchmarks/*.bench.ts` | Vitest bench files             |
| Bundle analysis     | Generated in CI               | Size tracking via `bundlesize` |
| Optimization report | N/A (review artifact)         | PR comments or issues          |

## Quality Standards

### Performance Targets

| Metric                         | Target    | Measurement                                 |
| ------------------------------ | --------- | ------------------------------------------- |
| Bundle size (gzipped)          | <30KB     | `pnpm build` + `bundlesize` or `size-limit` |
| Routing latency (100 agents)   | <10ms p95 | Vitest bench                                |
| Routing latency (1000 agents)  | <50ms p95 | Vitest bench                                |
| Compression latency (500 msgs) | <20ms p95 | Vitest bench                                |
| Concurrent handoffs            | >100/s    | Load test                                   |
| Memory per handoff             | <1MB peak | Heap snapshot                               |

### Optimization Checklist

- [ ] No `JSON.stringify` on large objects in hot paths
- [ ] No recursive deep-copy in `HandoffExecutor`
- [ ] `AgentRegistry` uses `Map<string, AgentCapabilities>` not array scans
- [ ] `CapabilityBasedRouter` scoring loop is pure and allocation-minimal
- [ ] `TypedEventEmitter` does not create closures per emission
- [ ] Tree-shaking verified: unused exports are dropped from bundle
- [ ] No top-level side effects that prevent tree-shaking

### Benchmark Requirements

```typescript
import { bench, describe } from 'vitest';

describe('routing performance', () => {
  bench('route to 100 agents', async () => {
    /* ... */
  });
  bench('route to 1000 agents', async () => {
    /* ... */
  });
});

describe('compression performance', () => {
  bench('compress 100 messages', async () => {
    /* ... */
  });
  bench('compress 500 messages', async () => {
    /* ... */
  });
  bench('compress 1000 messages', async () => {
    /* ... */
  });
});
```

## Common Pitfalls

- **Do not** optimize prematurely. Measure first with benchmarks.
- **Do not** sacrifice type safety for speed. Use `strict` TypeScript even in hot paths.
- **Do not** add caching without TTL. Stale agent capabilities cause routing errors.
- **Do not** use `JSON.parse(JSON.stringify(obj))` for cloning. It is slow and loses `Date` objects.
- **Do not** ignore memory leaks in event listeners. `off` must clean up references.

## Cross-References

- ARCHITECTURE.md § "Performance Optimizations"
- ARCHITECTURE.md § "Testing Strategy" → Performance tests
- DEV_PLAN.md § "Quality Gates" → Bundle size, latency targets
- testing-strategy skill → Benchmark suite setup
