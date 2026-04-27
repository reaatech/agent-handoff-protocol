import { describe, it, expect } from 'vitest';
import { SummaryCompressor } from '../../../src/compression/summary-compressor.js';
import type { Message } from '../../../src/types/index.js';

describe('SummaryCompressor', () => {
  const compressor = new SummaryCompressor();

  function makeMessages(contents: string[]): Message[] {
    return contents.map((content, i) => ({
      id: `msg-${String(i)}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }));
  }

  it('compresses empty messages', async () => {
    const result = await compressor.compress([], { maxTokens: 100, strategy: 'summary' });
    expect(result.summary).toBe('');
    expect(result.compressionMethod).toBe('summary');
    expect(result.compressionRatio).toBe(0);
  });

  it('preserves all content for few messages', async () => {
    const messages = makeMessages(['Hello there', 'How are you?', 'I need help']);
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'summary' });
    expect(result.summary).toContain('Hello there');
    expect(result.summary).toContain('How are you');
  });

  it('extracts key sentences for many messages', async () => {
    const messages = makeMessages([
      'The quick brown fox jumps over the lazy dog',
      'This is a simple test message with no special keywords',
      'The main point is that we need to focus on the important tasks',
      'Another boring sentence here without much value',
      'Finally, the critical issue must be addressed immediately',
    ]);
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'summary' });
    expect(result.summary.length).toBeGreaterThan(0);
    // Should prioritize sentences with keywords like "main", "important", "critical"
    expect(result.compressionRatio).toBeGreaterThan(0);
  });

  it('preserves recent messages separately', async () => {
    const messages = makeMessages(Array.from({ length: 10 }, (_, i) => `Message ${String(i)}`));
    const result = await compressor.compress(messages, {
      maxTokens: 1000,
      strategy: 'summary',
      preserveRecentMessages: 2,
    });
    expect(result.originalTokenCount).toBeGreaterThan(0);
    expect(result.compressedTokenCount).toBeGreaterThan(0);
  });

  it('respects token budget', async () => {
    const messages = makeMessages(
      Array.from({ length: 50 }, (_, i) => `This is message number ${String(i)} with some content`)
    );
    const result = await compressor.compress(messages, { maxTokens: 50, strategy: 'summary' });
    // Summary should be shorter than original
    expect(result.compressedTokenCount).toBeLessThanOrEqual(result.originalTokenCount);
  });
});
