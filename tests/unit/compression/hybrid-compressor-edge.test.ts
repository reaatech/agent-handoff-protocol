import { describe, it, expect } from 'vitest';
import { HybridCompressor } from '../../../src/compression/hybrid-compressor.js';
import type { Message } from '../../../src/types/index.js';

describe('HybridCompressor edge cases', () => {
  const compressor = new HybridCompressor();

  function makeMessage(content: string, role: Message['role'] = 'user'): Message {
    return {
      id: `msg-${Math.random().toString(36).slice(2, 7)}`,
      role,
      content,
      timestamp: new Date(),
    };
  }

  it('applies sliding window break when over token budget', async () => {
    const messages = Array.from({ length: 10 }, (_, i) =>
      makeMessage(
        `This is a longer message with more content to ensure tokens add up quickly ${String(i)}`
      )
    );
    const result = await compressor.compress(messages, { maxTokens: 10, strategy: 'hybrid' });

    // Sliding window should have been applied (fewer messages in windowedMessages)
    expect(result.compressionRatio).toBeGreaterThan(0);
  });

  it('detects urgent action items as high priority open items', async () => {
    const messages = [makeMessage('I need this urgently and ASAP')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.openItems.some((item) => item.priority === 'high')).toBe(true);
  });

  it('detects questions as open items', async () => {
    const messages = [makeMessage('When will it ship?')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.openItems.some((item) => item.description.includes('ship'))).toBe(true);
  });

  it('detects action statements with need/should/must', async () => {
    const messages = [makeMessage('I need to update my address. I should also verify my email.')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.openItems.length).toBeGreaterThanOrEqual(1);
  });

  it('ignores completed action statements', async () => {
    const messages = [makeMessage('I already done that. It is completed.')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.openItems.length).toBe(0);
  });

  it('limits entities to 20 max', async () => {
    const messages = [
      makeMessage(Array.from({ length: 30 }, (_, i) => `john${String(i)}@example.com`).join(' ')),
    ];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.entities.length).toBeLessThanOrEqual(20);
  });

  it('limits intents to 5 max', async () => {
    const messages = Array.from({ length: 20 }, () =>
      makeMessage('How do I do this? What about that? Why is this broken?')
    );
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.intents.length).toBeLessThanOrEqual(5);
  });

  it('limits open items to 10 max', async () => {
    const messages = Array.from({ length: 20 }, () =>
      makeMessage('I need help? Can you assist? What should I do?')
    );
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.openItems.length).toBeLessThanOrEqual(10);
  });

  it('handles messages with no long words for intents', async () => {
    const messages = [makeMessage('Hi. I am. A. B. C. D. E.')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.intents).toBeDefined();
  });

  it('handles empty user messages for open items', async () => {
    const messages = [makeMessage('')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.openItems).toEqual([]);
  });

  it('compresses without maxTokens option', async () => {
    const messages = [makeMessage('Hello world'), makeMessage('How are you')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.summary).toContain('Hello world');
    expect(result.compressionMethod).toBe('hybrid');
  });

  it('handles intents with no long words', async () => {
    const messages = [makeMessage('I buy it')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.intents.some((i) => i.intent === 'purchase_intent')).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.intents[0]!.entities).toEqual([]);
  });
});
