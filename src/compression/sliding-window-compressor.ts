import type { Message, CompressionOptions, CompressedContext } from '../types/index.js';
import { BaseCompressor } from './context-compressor.js';

export class SlidingWindowCompressor extends BaseCompressor {
  // eslint-disable-next-line @typescript-eslint/require-await
  async compress(messages: Message[], options?: CompressionOptions): Promise<CompressedContext> {
    const preserveCount = options?.preserveRecentMessages ?? 0;
    const recentMessages = preserveCount > 0 ? messages.slice(-preserveCount) : [];
    const historicalMessages = preserveCount > 0 ? messages.slice(0, -preserveCount) : messages;

    const windowed = this.applySlidingWindow(historicalMessages, options);
    const summary = windowed.map((m) => m.content).join('\n');

    const allContent = [...recentMessages.map((m) => m.content), summary].join('\n');

    const originalTokenCount = this.estimateTokens(messages.map((m) => m.content).join('\n'));
    const compressedTokenCount = this.estimateTokens(allContent);

    return {
      summary,
      keyFacts: [],
      entities: [],
      intents: [],
      openItems: [],
      compressionMethod: 'sliding_window',
      originalTokenCount,
      compressedTokenCount,
      compressionRatio: originalTokenCount > 0 ? compressedTokenCount / originalTokenCount : 0,
    };
  }

  private applySlidingWindow(messages: Message[], options?: CompressionOptions): Message[] {
    if (!options?.maxTokens) return messages;

    const result: Message[] = [];
    let tokenCount = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg) continue;
      const msgTokens = this.estimateTokens(msg.content);
      if (tokenCount + msgTokens > options.maxTokens && result.length > 0) {
        break;
      }
      result.unshift(msg);
      tokenCount += msgTokens;
    }

    return result;
  }
}
