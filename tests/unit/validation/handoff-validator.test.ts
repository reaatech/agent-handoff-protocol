import { describe, it, expect } from 'vitest';
import { HandoffValidator } from '../../../src/validation/handoff-validator.js';
import type { HandoffPayload, AgentCapabilities } from '../../../src/types/index.js';

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
    userMetadata: { userId: 'u-1', language: 'en' },
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

describe('HandoffValidator', () => {
  const validator = new HandoffValidator();

  it('validates a correct payload', async () => {
    const result = await validator.validatePayload(createPayload(), createAgent());
    expect(result.isValid).toBe(true);
  });

  it('validates agent capabilities', () => {
    const result = validator.validateAgentCapabilities(createAgent());
    expect(result.isValid).toBe(true);
  });

  it('validates compatibility', () => {
    const result = validator.validateCompatibility(createPayload(), createAgent());
    expect(result.isValid).toBe(true);
  });

  it('detects incompatible language', () => {
    const result = validator.validateCompatibility(
      createPayload({ userMetadata: { userId: 'u-1', language: 'de' } }),
      createAgent()
    );
    expect(result.isValid).toBe(false);
  });

  it('detects overloaded agent', () => {
    const result = validator.validateCompatibility(
      createPayload(),
      createAgent({ currentLoad: 10, maxConcurrentSessions: 10 })
    );
    expect(result.isValid).toBe(false);
  });

  it('returns combined schema and compatibility errors via zod path', async () => {
    const result = await validator.validatePayload(
      createPayload({
        handoffId: '', // schema violation (min length)
        userMetadata: { userId: 'u-1', language: 'fr' }, // compatibility violation
      }),
      createAgent()
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('handoffId'))).toBe(true);
    expect(result.errors.some((e) => e.includes('language'))).toBe(true);
  });

  it('classifies rejection reasons', () => {
    expect(validator.classifyRejectionReason('Missing skill')).toBe('capability_mismatch');
    expect(validator.classifyRejectionReason('At capacity')).toBe('overloaded');
    expect(validator.classifyRejectionReason('Validation failed')).toBe('invalid_payload');
    expect(validator.classifyRejectionReason('Timed out')).toBe('timeout');
    expect(validator.classifyRejectionReason('Offline')).toBe('unavailable');
    expect(validator.classifyRejectionReason('Unknown error')).toBe('unknown');
  });
});
