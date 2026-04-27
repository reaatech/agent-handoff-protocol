# Routing Engine Skill

## Description

Implements the route/clarify/fallback decision tree and agent selection logic for optimal handoff routing.

## Capabilities

- Design scoring algorithms for agent matching
- Implement routing decision trees (primary / clarification / fallback)
- Handle ambiguity and clarification flows
- Optimize routing performance for large agent registries
- Support multiple routing policies (`strict`, `best_effort`, `hierarchical`)
- Calculate agent compatibility scores with weighted factors

## Triggers

- When implementing routing logic
- When tuning scoring weights
- When adding new routing policies
- When optimizing route selection latency
- When handling routing edge cases (all agents busy, all reject, zero matches)

## Handoff Conditions

- Complex multi-criteria decisions requiring domain expertise
- Machine learning optimization for scoring
- Performance bottlenecks detected in routing (target: <50ms p95)
- Ambiguous routing scenarios with no clear winner
- Dynamic agent availability changes during routing

## Dependencies

- `typescript-architecture` (for type definitions)
- `performance-optimization` (for latency optimization)

## Outputs

- Routing decisions (`PrimaryRoute`, `ClarificationRoute`, `FallbackRoute`)
- Agent scores and rankings
- Clarification questions (for ambiguous cases)
- Routing metrics emitted via events
- Decision explanations (for debugging)

## Quality Standards

### Scoring Formula

The default scoring algorithm in `CapabilityBasedRouter` uses these weights:

| Factor         | Weight | Description                                                 |
| -------------- | ------ | ----------------------------------------------------------- |
| Skill match    | 40%    | Jaccard similarity between required skills and agent skills |
| Domain match   | 30%    | Overlap between payload domains and agent domains           |
| Load factor    | 20%    | `1 - (currentLoad / maxConcurrentSessions)`                 |
| Language match | 10%    | Exact match on user language preference                     |

**Scoring must be deterministic**: Given the same `HandoffPayload` and `AgentCapabilities[]`, the router must return the same scores (modulo agent state changes).

### Ambiguity Threshold

Two candidates are considered ambiguous when:

```
topScore - secondScore < config.ambiguityThreshold
```

Default `ambiguityThreshold` is `0.15`. This means if the best agent scores `0.85` and the second scores `0.75`, the difference is `0.10`, which is less than `0.15`, so the router returns a `ClarificationRoute`.

### Routing Policies

1. **strict**: Only route if the best match exceeds `minConfidenceThreshold`. Otherwise return `FallbackRoute`.
2. **best_effort**: Always route to the best available agent, even if below threshold. Emit a warning event.
3. **hierarchical**: Try specialist agents first. If no match, fall back to generalist agents.

### Example Test Cases

When implementing or modifying routing, these test cases must pass:

| Case           | Agents                                                | Expected Decision                          |
| -------------- | ----------------------------------------------------- | ------------------------------------------ |
| Perfect match  | One agent with exact skill/domain match               | `PrimaryRoute`                             |
| No match       | Zero agents with overlapping skills                   | `FallbackRoute` (reason: `no_match`)       |
| Ambiguous      | Two agents with scores 0.92 and 0.80                  | `ClarificationRoute`                       |
| Low confidence | Best agent scores 0.50, threshold 0.70                | `FallbackRoute` (reason: `low_confidence`) |
| All busy       | All agents at `currentLoad === maxConcurrentSessions` | `FallbackRoute` (reason: `all_busy`)       |

## Performance Targets

- Routing decision latency: **<10ms** for registries up to 100 agents
- Routing decision latency: **<50ms** for registries up to 1000 agents
- If latency exceeds targets, hand off to `performance-optimization` for profiling

## Common Pitfalls

- **Do not** mutate the `availableAgents` array during scoring.
- **Do not** call async operations inside the scoring loop unless necessary (e.g., health checks should be cached).
- **Do not** return a `PrimaryRoute` without at least one alternative when alternatives exist. Always provide fallback options in the `alternatives` array.
- **Do not** use floating-point equality for score comparisons. Use the configured `ambiguityThreshold`.
