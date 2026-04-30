import type { CompressedContext, CompressionOptions, Message } from '@reaatech/agent-handoff';

export interface TokenCounter {
  estimate(text: string): number;
}

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
