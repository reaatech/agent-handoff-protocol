/**
 * Custom Compression Strategy
 *
 * This example shows how to implement a custom ContextCompressor
 * that only keeps the last N messages without any summarization.
 */

import type {
  Message,
  CompressionOptions,
  CompressedContext,
  ContextCompressor,
} from '@reaatech/agent-handoff-protocol';

export class LastNCompressor implements ContextCompressor {
  async compress(messages: Message[], options?: CompressionOptions): Promise<CompressedContext> {
    const limit = options?.maxTokens ?? 10;
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
