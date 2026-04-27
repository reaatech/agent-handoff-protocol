# Compression Algorithms Skill

## Description

Specializes in the algorithmic details of context compression and token estimation. Works under the `context-compression` skill for advanced optimization, custom strategies, and token-counting accuracy.

## Capabilities

- Implement `TokenCounter` with a fast heuristic (no heavy ML dependencies)
- Design extractive summarization for `SummaryCompressor`
- Implement sliding-window selection for `SlidingWindowCompressor`
- Benchmark compression ratios and latency
- Handle edge cases (empty messages, very long single messages, Unicode)

## Triggers

- When implementing or modifying `src/compression/token-counter.ts`
- When optimizing compression ratios
- When handling very large contexts (>1000 messages)
- When implementing new compression strategies (post-v1)

## Handoff Conditions

- Algorithm complexity issues ( NLP dependencies, transformer models)
- Performance vs. quality trade-offs (aggressive compression loses context)
- Integration with LLM APIs (token counting must match target model)
- Custom compression requirements (domain-specific summarization)

## Dependencies

- `typescript-architecture` (for `ContextCompressor` interface)
- `context-compression` (for integration into `HybridCompressor`)
- `performance-optimization` (for latency targets)

## Outputs

| Output                  | Path                                           | Description                 |
| ----------------------- | ---------------------------------------------- | --------------------------- |
| TokenCounter            | `src/compression/token-counter.ts`             | Heuristic token estimator   |
| SummaryCompressor       | `src/compression/summary-compressor.ts`        | Extractive summarization    |
| SlidingWindowCompressor | `src/compression/sliding-window-compressor.ts` | Recency-based compressor    |
| Unit tests              | `tests/unit/compression/*.test.ts`             | Algorithm correctness tests |

## Quality Standards

### Implementation Checklist

- [ ] `TokenCounter.estimate(text)` returns a number; no async, no ML deps
- [ ] Token estimation uses a simple heuristic: ~4 chars per token for ASCII, ~1.5 chars per token for CJK
- [ ] `SummaryCompressor` uses extractive sentence scoring (TF-IDF or position-based) — no LLM required
- [ ] `SlidingWindowCompressor` selects the most recent messages that fit within `maxTokens`
- [ ] `SlidingWindowCompressor` respects `preserveRecentMessages` — these are always included verbatim
- [ ] All compressors handle empty input gracefully (return empty summary, zero counts)
- [ ] Compression latency target: **<20ms** for 500 messages

### TokenCounter Heuristic

```typescript
export class TokenCounter {
  estimate(text: string): number {
    // Fast heuristic: weighted by Unicode block
    let tokens = 0;
    for (const char of text) {
      const code = char.charCodeAt(0);
      if (code >= 0x4e00 && code <= 0x9fff) {
        tokens += 0.67; // CJK
      } else {
        tokens += 0.25; // ASCII / Latin
      }
    }
    return Math.ceil(tokens);
  }
}
```

### Test Requirements

- [ ] Token count accuracy within ±20% of tiktoken for English text
- [ ] Token count accuracy within ±30% for mixed-language text
- [ ] `SummaryCompressor` preserves at least one sentence from each topic cluster (if applicable)
- [ ] `SlidingWindowCompressor` never exceeds `maxTokens`
- [ ] Edge cases: empty array, single message > maxTokens, all messages < maxTokens
- [ ] Benchmark: compress 100 / 500 / 1000 messages and record latency

## Common Pitfalls

- **Do not** import `tiktoken`, `gpt-tokenizer`, or any WASM/ML dependency. The library must remain zero-runtime-dependency.
- **Do not** use regex-based sentence splitting on all languages. For v1, document that sentence splitting is best-effort for ASCII/CJK.
- **Do not** mutate the input `messages` array during compression. Always work on copies.
- **Do not** include the full `messages` array in `CompressedContext`. The architecture stores `sessionHistory` separately in `HandoffPayload`.
- **Do not** forget to set `compressionMethod` to the exact strategy name (`'summary'`, `'sliding_window'`, `'hybrid'`).

## Cross-References

- ARCHITECTURE.md § "Context Compression Engine" → `ContextCompressor`, `HybridCompressor`
- ARCHITECTURE.md § "Compression Options" → `CompressionOptions`
- ARCHITECTURE.md § "Performance Optimizations" → Token estimation, streaming-friendly design
- DEV_PLAN.md § Sprint 2 → Context Compression Engine
