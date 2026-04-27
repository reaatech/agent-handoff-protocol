import { describe, it, expect } from 'vitest';
import { HybridCompressor } from '../../../src/compression/hybrid-compressor.js';
import type { Message } from '../../../src/types/index.js';

describe('HybridCompressor advanced features', () => {
  const compressor = new HybridCompressor();

  function makeMessage(content: string, role: Message['role'] = 'user'): Message {
    return {
      id: `msg-${Math.random().toString(36).slice(2, 7)}`,
      role,
      content,
      timestamp: new Date(),
    };
  }

  it('extracts email entities', async () => {
    const messages = [makeMessage('Contact me at john.doe@example.com for details')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    const emails = result.entities.filter((e) => e.type === 'email');
    expect(emails.length).toBe(1);
    expect(emails[0]?.name).toBe('john.doe@example.com');
  });

  it('extracts phone number entities', async () => {
    const messages = [makeMessage('Call me at 555-123-4567 anytime')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    const phones = result.entities.filter((e) => e.type === 'phone');
    expect(phones.length).toBe(1);
    expect(phones[0]?.name).toBe('555-123-4567');
  });

  it('extracts capitalized name entities', async () => {
    const messages = [makeMessage('John Smith will handle your case')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    const names = result.entities.filter((e) => e.type === 'name');
    expect(names.length).toBeGreaterThan(0);
  });

  it('identifies help intent', async () => {
    const messages = [makeMessage('I need help with my account')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.intents.some((i) => i.intent === 'request_help')).toBe(true);
  });

  it('identifies question intent', async () => {
    const messages = [makeMessage('How do I reset my password?')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.intents.some((i) => i.intent === 'ask_question')).toBe(true);
  });

  it('identifies complaint intent', async () => {
    const messages = [makeMessage('This is not working and I am frustrated')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.intents.some((i) => i.intent === 'complaint')).toBe(true);
  });

  it('identifies open items from questions', async () => {
    const messages = [makeMessage('When will my order ship?')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.openItems.length).toBeGreaterThan(0);
    expect(result.openItems[0]?.description).toContain('When will my order ship');
  });

  it('identifies open items from action statements', async () => {
    const messages = [makeMessage('I need to update my billing address')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.openItems.length).toBeGreaterThan(0);
  });

  it('sets high priority for urgent items', async () => {
    const messages = [makeMessage('This is urgent! I need help ASAP?')];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.openItems.some((item) => item.priority === 'high')).toBe(true);
  });

  it('filters out system messages from key facts', async () => {
    const messages = [
      makeMessage('The user needs a refund', 'system'),
      makeMessage('I want a refund', 'user'),
    ];
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    const factSources = result.keyFacts.flatMap((f) => f.sourceMessageIds);
    expect(factSources).not.toContain(messages[0]?.id);
  });

  it('limits key facts to 20 max', async () => {
    const messages = Array.from({ length: 30 }, () =>
      makeMessage('This is a very important factual statement that contains the word is.')
    );
    const result = await compressor.compress(messages, { maxTokens: 1000, strategy: 'hybrid' });

    expect(result.keyFacts.length).toBeLessThanOrEqual(20);
  });
});
