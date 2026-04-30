import type { AgentCapabilities, HandoffPayload } from '@reaatech/agent-handoff';
import { describe, expect, it } from 'vitest';
import { createZodValidator } from './zod-schemas.js';

function createPayload(overrides?: Partial<HandoffPayload>): HandoffPayload {
  return {
    handoffId: 'h-1',
    sessionId: 's-1',
    conversationId: 'c-1',
    sessionHistory: [],
    compressedContext: {
      summary: '',
      keyFacts: [],
      intents: [],
      entities: [],
      openItems: [],
      compressionMethod: 'hybrid',
      originalTokenCount: 0,
      compressedTokenCount: 0,
      compressionRatio: 0,
    },
    handoffReason: {
      type: 'confidence_too_low',
      currentConfidence: 0.4,
      threshold: 0.6,
      message: '',
    },
    userMetadata: { userId: 'u-1' },
    conversationState: { resolvedEntities: {}, openQuestions: [], contextVariables: {} },
    createdAt: new Date(),
    ...overrides,
  };
}

function createAgent(overrides?: Partial<AgentCapabilities>): AgentCapabilities {
  return {
    agentId: 'agent-1',
    agentName: 'Test Agent',
    skills: ['typescript'],
    domains: ['dev'],
    maxConcurrentSessions: 10,
    currentLoad: 2,
    languages: ['en'],
    specializations: [],
    availability: 'available',
    version: '1.0.0',
    ...overrides,
  };
}

describe('createZodValidator', () => {
  const validator = createZodValidator();

  it('returns valid for correct payload and agent', () => {
    const result = validator(createPayload(), createAgent());
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('collects payload validation errors', () => {
    const result = validator(createPayload({ handoffId: '' }), createAgent());
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('handoffId'))).toBe(true);
  });

  it('collects agent validation errors', () => {
    const result = validator(createPayload(), createAgent({ agentId: '' }));
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('agentId'))).toBe(true);
  });

  it('collects both payload and agent errors', () => {
    const result = validator(
      createPayload({ sessionId: '' }),
      createAgent({ maxConcurrentSessions: 0 }),
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
