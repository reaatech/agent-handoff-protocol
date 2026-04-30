import type { AgentCapabilities, HandoffPayload } from '@reaatech/agent-handoff';
import { describe, expect, it } from 'vitest';
import { CapabilityBasedRouter } from './handoff-router.js';

function createAgent(overrides?: Partial<AgentCapabilities>): AgentCapabilities {
  return {
    agentId: 'agent-1',
    agentName: 'Test Agent',
    skills: ['typescript', 'architecture'],
    domains: ['development'],
    maxConcurrentSessions: 10,
    currentLoad: 2,
    languages: ['en'],
    specializations: [],
    availability: 'available',
    version: '1.0.0',
    ...overrides,
  };
}

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

describe('CapabilityBasedRouter edge cases', () => {
  const config = {
    minConfidenceThreshold: 0.7,
    ambiguityThreshold: 0.15,
    maxAlternatives: 3,
    policy: 'best_effort' as const,
  };

  it('handles escalation_requested trigger', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload({
      handoffReason: { type: 'escalation_requested', reason: 'user angry', requestedBy: 'user' },
    });
    const agent = createAgent({ skills: ['escalation', 'supervisor'] });

    const result = await router.route(payload, [agent]);

    expect(result.type).toBe('primary');
  });

  it('handles load_balancing trigger', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload({
      handoffReason: { type: 'load_balancing', currentLoad: 0.9, threshold: 0.8 },
    });
    const agent = createAgent({ currentLoad: 1 });

    const result = await router.route(payload, [agent]);

    expect(result.type).toBe('primary');
  });

  it('uses conversation intent for confidence_too_low scoring', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload({
      handoffReason: {
        type: 'confidence_too_low',
        currentConfidence: 0.4,
        threshold: 0.6,
        message: '',
      },
      conversationState: {
        currentIntent: 'billing',
        resolvedEntities: {},
        openQuestions: [],
        contextVariables: {},
      },
    });
    const a = createAgent({ agentId: 'a', skills: ['billing'], domains: ['billing'] });
    const b = createAgent({ agentId: 'b', skills: ['sales'], domains: ['sales'] });

    const result = await router.route(payload, [a, b]);

    expect(result.type).toBe('primary');
    expect((result as { targetAgent: AgentCapabilities }).targetAgent.agentId).toBe('a');
  });

  it('filters busy agents at max capacity', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload();
    const agent = createAgent({ currentLoad: 10, maxConcurrentSessions: 10 });

    const result = await router.route(payload, [agent]);
    expect(result.type).toBe('fallback');
  });

  it('filters away agents when expiry is set', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload({ expiresAt: new Date(Date.now() + 1000) });
    const agent = createAgent({ availability: 'away' });

    const result = await router.route(payload, [agent]);
    expect(result.type).toBe('fallback');
  });

  it('allows away agents when no expiry', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload();
    const agent = createAgent({ availability: 'away' });

    const result = await router.route(payload, [agent]);
    expect(result.type).toBe('primary');
  });

  it('scores domain match from topic_boundary_crossed', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload({
      handoffReason: {
        type: 'topic_boundary_crossed',
        fromTopic: 'sales',
        toTopic: 'billing',
        confidence: 0.9,
      },
    });
    const a = createAgent({ agentId: 'a', domains: ['billing'], skills: [] });
    const b = createAgent({ agentId: 'b', domains: ['sales'], skills: [] });

    const result = await router.route(payload, [a, b]);

    expect(result.type).toBe('primary');
    expect((result as { targetAgent: AgentCapabilities }).targetAgent.agentId).toBe('a');
  });

  it('returns fallback when all agents are offline', async () => {
    const router = new CapabilityBasedRouter(config);
    const agents = [
      createAgent({ availability: 'offline' }),
      createAgent({ availability: 'offline' }),
    ];

    const result = await router.route(createPayload(), agents);
    expect(result.type).toBe('fallback');
  });

  it('handles hierarchical policy', async () => {
    const hierarchicalConfig = { ...config, policy: 'hierarchical' as const };
    const router = new CapabilityBasedRouter(hierarchicalConfig);
    const payload = createPayload({
      handoffReason: {
        type: 'specialist_required',
        requiredSkills: ['python'],
        currentAgentSkills: [],
      },
    });
    const agent = createAgent({ skills: ['typescript'] });

    const result = await router.route(payload, [agent]);

    // Hierarchical policy isn't fully implemented; it falls through to normal handling
    expect(result.type).toBe('fallback');
  });

  it('scores agents with zero maxConcurrentSessions as 0 load factor', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload();
    const agent = createAgent({ maxConcurrentSessions: 0 });

    const result = await router.route(payload, [agent]);
    // Should still route since load factor is 0 but other scores may not be enough
    expect(result.type).toBe('fallback');
  });

  it('generates domain-specific clarification questions', async () => {
    const router = new CapabilityBasedRouter({
      ...config,
      minConfidenceThreshold: 0.5,
      ambiguityThreshold: 0.5,
    });
    const payload = createPayload({
      handoffReason: {
        type: 'confidence_too_low',
        currentConfidence: 0.4,
        threshold: 0.6,
        message: '',
      },
    });
    const a = createAgent({
      agentId: 'a',
      domains: ['frontend'],
      skills: ['react'],
      currentLoad: 2,
    });
    const b = createAgent({ agentId: 'b', domains: ['backend'], skills: ['node'], currentLoad: 2 });

    const result = await router.route(payload, [a, b]);

    expect(result.type).toBe('clarification');
    const questions = (result as { clarificationQuestions: string[] }).clarificationQuestions;
    expect(questions.some((q) => q.includes('frontend') || q.includes('backend'))).toBe(true);
  });

  it('generates skill-specific clarification questions', async () => {
    const router = new CapabilityBasedRouter({
      ...config,
      minConfidenceThreshold: 0.5,
      ambiguityThreshold: 0.5,
    });
    const payload = createPayload({
      handoffReason: {
        type: 'confidence_too_low',
        currentConfidence: 0.4,
        threshold: 0.6,
        message: '',
      },
    });
    const a = createAgent({ agentId: 'a', domains: ['dev'], skills: ['react'], currentLoad: 2 });
    const b = createAgent({ agentId: 'b', domains: ['dev'], skills: ['angular'], currentLoad: 2 });

    const result = await router.route(payload, [a, b]);

    expect(result.type).toBe('clarification');
    const questions = (result as { clarificationQuestions: string[] }).clarificationQuestions;
    expect(questions.some((q) => q.includes('angular'))).toBe(true);
  });
});
