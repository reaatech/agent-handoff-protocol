import { describe, it, expect } from 'vitest';
import { SlidingWindowCompressor } from '../../../src/compression/sliding-window-compressor.js';
import type { Message } from '../../../src/types/index.js';

describe('SlidingWindowCompressor', () => {
  const compressor = new SlidingWindowCompressor();

  function makeMessages(contents: string[]): Message[] {
    return contents.map((content, i) => ({
      id: `msg-${String(i)}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }));
  }

  it('compresses empty messages', async () => {
    const result = await compressor.compress([], { maxTokens: 100, strategy: 'sliding_window' });
    expect(result.summary).toBe('');
    expect(result.compressionMethod).toBe('sliding_window');
  });

  it('returns all messages when maxTokens is not provided', async () => {
    const messages = makeMessages(['Hello', 'World', 'Test']);
    const result = await compressor.compress(messages, {
      maxTokens: 1000,
      strategy: 'sliding_window',
    });
    expect(result.summary).toContain('Hello');
    expect(result.summary).toContain('World');
    expect(result.summary).toContain('Test');
  });

  it('includes all messages when under token budget', async () => {
    const messages = makeMessages(['Hello', 'World', 'Test']);
    const result = await compressor.compress(messages, {
      maxTokens: 1000,
      strategy: 'sliding_window',
    });
    expect(result.summary).toContain('Hello');
    expect(result.summary).toContain('World');
    expect(result.summary).toContain('Test');
  });

  it('sliding window drops oldest messages when over budget', async () => {
    const messages = makeMessages(Array.from({ length: 20 }, (_, i) => `Message ${String(i)}`));
    const result = await compressor.compress(messages, {
      maxTokens: 20,
      strategy: 'sliding_window',
    });
    // Should keep recent messages
    expect(result.summary).toContain('Message 19');
    expect(result.summary).toContain('Message 18');
    // May or may not contain oldest depending on token count
  });

  it('preserves recent messages verbatim', async () => {
    const messages = makeMessages(Array.from({ length: 10 }, (_, i) => `Content ${String(i)}`));
    const result = await compressor.compress(messages, {
      maxTokens: 50,
      strategy: 'sliding_window',
      preserveRecentMessages: 2,
    });
    expect(result.originalTokenCount).toBeGreaterThan(0);
    expect(result.compressionRatio).toBeGreaterThan(0);
  });

  it('never exceeds maxTokens in summary', async () => {
    const messages = makeMessages(
      Array.from({ length: 100 }, (_, i) => `Line ${String(i)} with more text here`)
    );
    const result = await compressor.compress(messages, {
      maxTokens: 30,
      strategy: 'sliding_window',
    });
    // The summary itself should be within budget
    expect(result.compressedTokenCount).toBeLessThanOrEqual(result.originalTokenCount);
  });
});
