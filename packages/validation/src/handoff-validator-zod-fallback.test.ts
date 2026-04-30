import { describe, expect, it, vi } from 'vitest';

describe('HandoffValidator zod fallback', () => {
  it('falls back to manual validation when zod module fails to load', async () => {
    vi.doMock('./zod-schemas.js', () => {
      throw new Error('zod not available');
    });

    // Must re-import after mock is established
    const { HandoffValidator } = await import('./handoff-validator.js');
    const validator = new HandoffValidator();

    const payload = {
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
    };

    const agent = {
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
    };

    const result = await validator.validatePayload(payload as never, agent as never);
    expect(result.isValid).toBe(true);

    vi.doUnmock('./zod-schemas.js');
  });
});
