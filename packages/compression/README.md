# @reaatech/agent-handoff-compression

[![npm version](https://img.shields.io/npm/v/@reaatech/agent-handoff-compression.svg)](https://www.npmjs.com/package/@reaatech/agent-handoff-compression)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/agent-handoff-protocol/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/agent-handoff-protocol/ci.yml?branch=main&label=CI)](https://github.com/reaatech/agent-handoff-protocol/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Context compression strategies for reducing conversation history before agent handoff. Includes three built-in compressors with configurable token budgets and a pluggable interface for custom implementations.

## Installation

```bash
npm install @reaatech/agent-handoff-compression
# or
pnpm add @reaatech/agent-handoff-compression
```

## Feature Overview

- **Three built-in strategies** — hybrid, summary, and sliding-window compressors
- **Hybrid compression** — sliding window + extractive summary + key fact extraction + entity detection + intent identification
- **Extractive summarization** — sentence scoring by position weight, length penalty, and keyword bonus
- **Sliding window** — most recent N messages within token budget, newest-first iteration
- **Fast token estimation** — heuristic CJK/ASCII counter, no external tokenizer required
- **Pluggable** — inject a custom `TokenCounter` (e.g. tiktoken) for your LLM's exact tokenizer
- **Composable** — each compressor implements `ContextCompressor` from `@reaatech/agent-handoff`

## Quick Start

```typescript
import {
  HybridCompressor,
  SummaryCompressor,
  SlidingWindowCompressor,
  SimpleTokenCounter,
} from '@reaatech/agent-handoff-compression';

const compressor = new HybridCompressor(new SimpleTokenCounter());

const result = await compressor.compress(messages, {
  maxTokens: 2000,
  preserveRecentMessages: 3,
});

console.log(result.summary);
console.log(`Compression ratio: ${result.compressionRatio}`);
console.log(`Key facts: ${result.keyFacts.length}`);
console.log(`Intents detected: ${result.intents.length}`);
```

## Exports

### Compressors

| Export | Strategy | Best For |
|---|---|---|
| `HybridCompressor` | Sliding window + summary + key facts + entities + intents | General purpose (default) |
| `SummaryCompressor` | Extractive summarization with sentence scoring | Long conversations needing a condensed overview |
| `SlidingWindowCompressor` | Most recent N messages within token budget | Chat-style agents where recency matters most |

### Base Classes & Interfaces

| Export | Description |
|---|---|
| `BaseCompressor` | Abstract class with `tokenCounter` and `estimateTokens()` |
| `SimpleTokenCounter` | Fast heuristic: CJK chars ≈ 0.67 tokens, ASCII ≈ 0.25 tokens |
| `TokenCounter` | Interface: `estimate(text: string): number` |
| `CompressionStrategy` | Interface: `name`, `compress(messages, options?)` |

### Compression Output (`CompressedContext`)

| Field | Type | Description |
|---|---|---|
| `summary` | `string` | Condensed conversation narrative |
| `keyFacts` | `KeyFact[]` | Extracted facts with importance scores and source message IDs |
| `intents` | `Intent[]` | Detected user intents with confidence scores |
| `entities` | `Entity[]` | Extracted emails, phones, names, organizations |
| `openItems` | `OpenItem[]` | Pending questions and action items with priority |
| `originalTokenCount` | `number` | Token count of uncompressed input |
| `compressedTokenCount` | `number` | Token count of compressed output |
| `compressionRatio` | `number` | `compressed / original` (lower = better compression) |

## Custom Compressors

Implement the `ContextCompressor` interface from `@reaatech/agent-handoff`:

```typescript
import type { Message, CompressionOptions, CompressedContext } from '@reaatech/agent-handoff';

class LastNCompressor implements ContextCompressor {
  async compress(messages: Message[], options?: CompressionOptions): Promise<CompressedContext> {
    const limit = options?.preserveRecentMessages ?? 10;
    const recent = messages.slice(-limit);

    return {
      summary: recent.map((m) => `${m.role}: ${m.content}`).join('\n'),
      keyFacts: [],
      entities: [],
      intents: [],
      openItems: [],
      compressionMethod: 'last_n',
      originalTokenCount: messages.length,
      compressedTokenCount: recent.length,
      compressionRatio: recent.length / Math.max(1, messages.length),
    };
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
```

## Related Packages

- [`@reaatech/agent-handoff`](https://www.npmjs.com/package/@reaatech/agent-handoff) — Core types, errors, utilities
- [`@reaatech/agent-handoff-routing`](https://www.npmjs.com/package/@reaatech/agent-handoff-routing) — Agent routing engine
- [`@reaatech/agent-handoff-protocol`](https://www.npmjs.com/package/@reaatech/agent-handoff-protocol) — Full orchestration layer

## License

[MIT](https://github.com/reaatech/agent-handoff-protocol/blob/main/LICENSE)
