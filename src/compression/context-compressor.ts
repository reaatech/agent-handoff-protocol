import type { Message, CompressionOptions, CompressedContext } from '../types/index.js';

export interface TokenCounter {
  estimate(text: string): number;
}

/**
 * Fast heuristic token counter with no external dependencies.
 *
 * Approximation rules:
 * - CJK characters (U+4E00–U+9FFF): ~0.67 tokens each
 * - All other characters: ~0.25 tokens each
 *
 * This is intentionally simple. For production use with specific
 * tokenizers (e.g. tiktoken), inject a custom {@link TokenCounter}.
 */
export class SimpleTokenCounter implements TokenCounter {
  estimate(text: string): number {
    let tokens = 0;
    for (const char of text) {
      const code = char.charCodeAt(0);
      if (code >= 0x4e00 && code <= 0x9fff) {
        tokens += 0.67;
      } else {
        tokens += 0.25;
      }
    }
    return Math.ceil(tokens);
  }
}

export interface CompressionStrategy {
  name: string;
  compress(messages: Message[], options?: CompressionOptions): Promise<Partial<CompressedContext>>;
}

export abstract class BaseCompressor {
  protected tokenCounter: TokenCounter;

  constructor(tokenCounter?: TokenCounter) {
    this.tokenCounter = tokenCounter ?? new SimpleTokenCounter();
  }

  estimateTokens(text: string): number {
    return this.tokenCounter.estimate(text);
  }
}
