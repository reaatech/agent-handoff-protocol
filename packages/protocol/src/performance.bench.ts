import type { AgentCapabilities, HandoffPayload, Message } from '@reaatech/agent-handoff';
import { HybridCompressor } from '@reaatech/agent-handoff-compression';
import { CapabilityBasedRouter } from '@reaatech/agent-handoff-routing';
import { bench, describe } from 'vitest';

function makeMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${String(i)}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `This is message number ${String(i)} with some content to ensure realistic token counts.`,
    timestamp: new Date(),
  }));
}

function makeAgents(count: number): AgentCapabilities[] {
  return Array.from({ length: count }, (_, i) => ({
    agentId: `agent-${String(i)}`,
    agentName: `Agent ${String(i)}`,
    skills: ['typescript', 'javascript', 'python'].slice(0, (i % 3) + 1),
    domains: ['frontend', 'backend', 'devops'].slice(0, (i % 3) + 1),
    maxConcurrentSessions: 10,
    currentLoad: i % 5,
    languages: ['en'],
    specializations: [],
    availability: 'available',
    version: '1.0.0',
  }));
}

function makePayload(): HandoffPayload {
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
  };
}

describe('Compression latency', () => {
  const compressor = new HybridCompressor();

  bench('100 messages', async () => {
    await compressor.compress(makeMessages(100), { maxTokens: 500, strategy: 'hybrid' });
  });

  bench('500 messages', async () => {
    await compressor.compress(makeMessages(500), { maxTokens: 500, strategy: 'hybrid' });
  });

  bench('1000 messages', async () => {
    await compressor.compress(makeMessages(1000), { maxTokens: 500, strategy: 'hybrid' });
  });
});

describe('Routing decision latency', () => {
  const router = new CapabilityBasedRouter({
    minConfidenceThreshold: 0.7,
    ambiguityThreshold: 0.15,
    maxAlternatives: 3,
    policy: 'best_effort',
  });

  const payload = makePayload();

  bench('5 agents', async () => {
    await router.route(payload, makeAgents(5));
  });

  bench('20 agents', async () => {
    await router.route(payload, makeAgents(20));
  });

  bench('100 agents', async () => {
    await router.route(payload, makeAgents(100));
  });
});
