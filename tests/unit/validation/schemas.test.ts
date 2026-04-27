import { describe, it, expect } from 'vitest';
import {
  validatePayloadManual,
  validateAgentCapabilitiesManual,
  validateCompatibilityManual,
  classifyRejectionReason,
} from '../../../src/validation/schemas.js';
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

describe('validatePayloadManual', () => {
  it('validates a correct payload', () => {
    const result = validatePayloadManual(createPayload(), createAgent());
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects empty handoffId', () => {
    const result = validatePayloadManual(createPayload({ handoffId: '' }), createAgent());
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('handoffId'))).toBe(true);
  });

  it('rejects long handoffId', () => {
    const result = validatePayloadManual(
      createPayload({ handoffId: 'x'.repeat(129) }),
      createAgent()
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('handoffId'))).toBe(true);
  });

  it('rejects invalid sessionHistory items', () => {
    const result = validatePayloadManual(
      createPayload({
        sessionHistory: [
          {
            id: '',
            role: 'invalid',
            content: 123,
          } as unknown as HandoffPayload['sessionHistory'][number],
        ],
      }),
      createAgent()
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects missing userMetadata.userId', () => {
    const result = validatePayloadManual(
      createPayload({ userMetadata: { userId: '' } }),
      createAgent()
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('userId'))).toBe(true);
  });

  it('rejects language mismatch', () => {
    const result = validatePayloadManual(
      createPayload({ userMetadata: { userId: 'u-1', language: 'fr' } }),
      createAgent({ languages: ['en'] })
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('language'))).toBe(true);
  });

  it('rejects overloaded agent', () => {
    const result = validatePayloadManual(
      createPayload(),
      createAgent({ currentLoad: 10, maxConcurrentSessions: 10 })
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('capacity'))).toBe(true);
  });

  it('rejects offline agent', () => {
    const result = validatePayloadManual(createPayload(), createAgent({ availability: 'offline' }));
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('offline'))).toBe(true);
  });

  it('rejects missing conversationState', () => {
    const result = validatePayloadManual(
      createPayload({
        conversationState: undefined as unknown as HandoffPayload['conversationState'],
      }),
      createAgent()
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('conversationState'))).toBe(true);
  });

  it('rejects negative originalTokenCount', () => {
    const result = validatePayloadManual(
      createPayload({
        compressedContext: {
          ...createPayload().compressedContext,
          originalTokenCount: -1,
        },
      }),
      createAgent()
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('originalTokenCount'))).toBe(true);
  });

  it('rejects negative compressedTokenCount', () => {
    const result = validatePayloadManual(
      createPayload({
        compressedContext: {
          ...createPayload().compressedContext,
          compressedTokenCount: -1,
        },
      }),
      createAgent()
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('compressedTokenCount'))).toBe(true);
  });

  it('rejects missing userMetadata entirely', () => {
    const result = validatePayloadManual(
      createPayload({
        userMetadata: undefined as unknown as HandoffPayload['userMetadata'],
      }),
      createAgent()
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('userMetadata is required'))).toBe(true);
  });
});

describe('validateAgentCapabilitiesManual', () => {
  it('validates a correct agent', () => {
    const result = validateAgentCapabilitiesManual(createAgent());
    expect(result.isValid).toBe(true);
  });

  it('rejects missing agentId', () => {
    const result = validateAgentCapabilitiesManual(createAgent({ agentId: '' }));
    expect(result.isValid).toBe(false);
  });

  it('rejects invalid maxConcurrentSessions', () => {
    const result = validateAgentCapabilitiesManual(createAgent({ maxConcurrentSessions: 0 }));
    expect(result.isValid).toBe(false);
  });

  it('rejects currentLoad > maxConcurrentSessions', () => {
    const result = validateAgentCapabilitiesManual(
      createAgent({ currentLoad: 11, maxConcurrentSessions: 10 })
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('currentLoad'))).toBe(true);
  });

  it('rejects invalid availability', () => {
    const result = validateAgentCapabilitiesManual(
      createAgent({ availability: 'sleeping' as AgentCapabilities['availability'] })
    );
    expect(result.isValid).toBe(false);
  });

  it('rejects non-string version', () => {
    const result = validateAgentCapabilitiesManual(
      createAgent({ version: 123 as unknown as string })
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
  });

  it('rejects non-array languages', () => {
    const result = validateAgentCapabilitiesManual(
      createAgent({ languages: 'en' as unknown as string[] })
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('languages'))).toBe(true);
  });

  it('rejects non-array specializations', () => {
    const result = validateAgentCapabilitiesManual(
      createAgent({ specializations: 'none' as unknown as never[] })
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('specializations'))).toBe(true);
  });

  it('rejects non-number maxConcurrentSessions', () => {
    const result = validateAgentCapabilitiesManual(
      createAgent({ maxConcurrentSessions: 'ten' as unknown as number })
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('maxConcurrentSessions'))).toBe(true);
  });

  it('rejects non-number currentLoad', () => {
    const result = validateAgentCapabilitiesManual(
      createAgent({ currentLoad: 'two' as unknown as number })
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('currentLoad'))).toBe(true);
  });

  it('rejects negative currentLoad', () => {
    const result = validateAgentCapabilitiesManual(createAgent({ currentLoad: -1 }));
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('currentLoad'))).toBe(true);
  });

  it('rejects non-array skills', () => {
    const result = validateAgentCapabilitiesManual(
      createAgent({ skills: 'typescript' as unknown as string[] })
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('skills'))).toBe(true);
  });

  it('rejects non-array domains', () => {
    const result = validateAgentCapabilitiesManual(
      createAgent({ domains: 'dev' as unknown as string[] })
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('domains'))).toBe(true);
  });

  it('rejects missing agentName', () => {
    const result = validateAgentCapabilitiesManual(createAgent({ agentName: '' }));
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('agentName'))).toBe(true);
  });
});

describe('validateCompatibilityManual', () => {
  it('returns empty for compatible agent', () => {
    const errors = validateCompatibilityManual(createPayload(), createAgent());
    expect(errors).toHaveLength(0);
  });

  it('detects language mismatch', () => {
    const errors = validateCompatibilityManual(
      createPayload({ userMetadata: { userId: 'u-1', language: 'de' } }),
      createAgent()
    );
    expect(errors.some((e) => e.includes('language'))).toBe(true);
  });

  it('detects away agent with expiry', () => {
    const errors = validateCompatibilityManual(
      createPayload({ expiresAt: new Date(Date.now() + 1000) }),
      createAgent({ availability: 'away' })
    );
    expect(errors.some((e) => e.includes('away'))).toBe(true);
  });

  it('detects excessive session history size', () => {
    const payload = createPayload({
      sessionHistory: Array.from({ length: 10001 }, (_, i) => ({
        id: `m-${String(i)}`,
        role: 'user' as const,
        content: 'hi',
        timestamp: new Date(),
      })),
    });
    const errors = validateCompatibilityManual(payload, createAgent());
    expect(errors.some((e) => e.includes('exceeds maximum size'))).toBe(true);
  });
});

describe('classifyRejectionReason', () => {
  it('classifies capability mismatch', () => {
    expect(classifyRejectionReason('Missing required skill')).toBe('capability_mismatch');
  });

  it('classifies overloaded', () => {
    expect(classifyRejectionReason('Agent is at capacity')).toBe('overloaded');
  });

  it('classifies invalid payload', () => {
    expect(classifyRejectionReason('Validation failed')).toBe('invalid_payload');
  });

  it('classifies timeout', () => {
    expect(classifyRejectionReason('Request timed out')).toBe('timeout');
  });

  it('classifies unavailable', () => {
    expect(classifyRejectionReason('Agent is offline')).toBe('unavailable');
  });

  it('classifies unknown', () => {
    expect(classifyRejectionReason('Something went wrong')).toBe('unknown');
  });
});
