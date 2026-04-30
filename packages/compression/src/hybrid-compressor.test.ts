import type { Message } from '@reaatech/agent-handoff';
import { describe, expect, it } from 'vitest';
import { HybridCompressor } from './hybrid-compressor.js';

describe('HybridCompressor', () => {
  const compressor = new HybridCompressor();

  function makeMessages(count: number): Message[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `msg-${String(i)}`,
      role: 'user',
      content: `Message ${String(i)}`,
      timestamp: new Date(),
    }));
  }

  it('compresses empty messages', async () => {
    const result = await compressor.compress([], { maxTokens: 100, strategy: 'hybrid' });
    expect(result.summary).toBe('');
    expect(result.compressionMethod).toBe('hybrid');
    expect(result.compressionRatio).toBe(0);
  });

  it('preserves recent messages', async () => {
    const messages = makeMessages(10);
    const result = await compressor.compress(messages, {
      maxTokens: 1000,
      strategy: 'hybrid',
      preserveRecentMessages: 2,
    });

    expect(result.summary).toContain('Message 0');
    expect(result.originalTokenCount).toBeGreaterThan(0);
  });

  it('generates a summary for many messages', async () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      id: `msg-${String(i)}`,
      role: 'user' as const,
      content: `This is an important message about topic ${String(i)} that contains factual information.`,
      timestamp: new Date(),
    }));
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.keyFacts.length).toBeGreaterThan(0);
  });
});
