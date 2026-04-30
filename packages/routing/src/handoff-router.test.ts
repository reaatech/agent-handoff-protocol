import { createHandoffConfig } from '@reaatech/agent-handoff';
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

describe('CapabilityBasedRouter', () => {
  const config = {
    minConfidenceThreshold: 0.7,
    ambiguityThreshold: 0.15,
    maxAlternatives: 3,
    policy: 'best_effort' as const,
  };

  it('returns FallbackRoute when no agents match', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload();
    const result = await router.route(payload, []);

    expect(result.type).toBe('fallback');
    expect((result as { reason: string }).reason).toBe('no_match');
  });

  it('returns PrimaryRoute for a good match', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload({
      handoffReason: {
        type: 'specialist_required',
        requiredSkills: ['typescript'],
        currentAgentSkills: [],
      },
    });
    const agent = createAgent({ skills: ['typescript'] });

    const result = await router.route(payload, [agent]);

    expect(result.type).toBe('primary');
    expect((result as { targetAgent: AgentCapabilities }).targetAgent.agentId).toBe('agent-1');
  });

  it('returns ClarificationRoute for ambiguous matches', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload({
      handoffReason: {
        type: 'specialist_required',
        requiredSkills: ['typescript'],
        currentAgentSkills: [],
      },
    });
    const a = createAgent({ agentId: 'a', skills: ['typescript'], domains: ['typescript'] });
    const b = createAgent({ agentId: 'b', skills: ['typescript'], domains: ['typescript'] });

    const result = await router.route(payload, [a, b]);

    expect(result.type).toBe('clarification');
  });

  it('filters offline agents', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload();
    const agent = createAgent({ availability: 'offline' });

    const result = await router.route(payload, [agent]);
    expect(result.type).toBe('fallback');
  });

  it('filters overloaded agents', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload();
    const agent = createAgent({ currentLoad: 10, maxConcurrentSessions: 10 });

    const result = await router.route(payload, [agent]);
    expect(result.type).toBe('fallback');
  });

  it('returns best_effort route when below threshold', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload({
      handoffReason: {
        type: 'specialist_required',
        requiredSkills: ['python'],
        currentAgentSkills: [],
      },
    });
    const agent = createAgent({ skills: ['typescript'] });

    const result = await router.route(payload, [agent]);

    expect(result.type).toBe('primary');
    expect((result as { confidence: number }).confidence).toBeLessThan(0.7);
  });

  it('returns low_confidence fallback for strict policy', async () => {
    const strictConfig = { ...config, policy: 'strict' as const };
    const router = new CapabilityBasedRouter(strictConfig);
    const payload = createPayload({
      handoffReason: {
        type: 'specialist_required',
        requiredSkills: ['python'],
        currentAgentSkills: [],
      },
    });
    const agent = createAgent({ skills: ['typescript'] });

    const result = await router.route(payload, [agent]);

    expect(result.type).toBe('fallback');
    expect((result as { reason: string }).reason).toBe('low_confidence');
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

  it('checks language compatibility', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload({
      userMetadata: { userId: 'u-1', language: 'es' },
    });
    const a = createAgent({ agentId: 'a', languages: ['es'] });
    const b = createAgent({ agentId: 'b', languages: ['en'] });

    const result = await router.route(payload, [a, b]);

    expect(result.type).toBe('primary');
    expect((result as { targetAgent: AgentCapabilities }).targetAgent.agentId).toBe('a');
  });

  it('generates clarification questions for ambiguous cases', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload({
      handoffReason: {
        type: 'specialist_required',
        requiredSkills: ['typescript'],
        currentAgentSkills: [],
      },
    });
    const a = createAgent({ agentId: 'a', skills: ['typescript'], domains: ['typescript'] });
    const b = createAgent({ agentId: 'b', skills: ['typescript'], domains: ['typescript'] });

    const result = await router.route(payload, [a, b]);

    expect(result.type).toBe('clarification');
    const clarification = result as { clarificationQuestions: string[] };
    expect(clarification.clarificationQuestions.length).toBeGreaterThan(0);
  });

  it('includes alternatives in PrimaryRoute', async () => {
    const router = new CapabilityBasedRouter(config);
    const payload = createPayload();
    const agents = [
      createAgent({ agentId: 'a', skills: ['typescript'] }),
      createAgent({ agentId: 'b', skills: ['typescript'] }),
      createAgent({ agentId: 'c', skills: ['typescript'] }),
    ];

    const result = await router.route(payload, agents);

    expect(result.type).toBe('primary');
    expect((result as { alternatives: AgentCapabilities[] }).alternatives.length).toBeGreaterThan(
      0,
    );
  });

  it('creates router from config', () => {
    const handoffConfig = createHandoffConfig();
    const router = CapabilityBasedRouter.fromConfig(handoffConfig);
    expect(router).toBeInstanceOf(CapabilityBasedRouter);
  });
});
