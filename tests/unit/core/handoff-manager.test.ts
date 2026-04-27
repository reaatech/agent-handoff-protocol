import { describe, it, expect, vi, type Mock } from 'vitest';
import { HandoffManager } from '../../../src/core/handoff-manager.js';
import { createHandoffConfig } from '../../../src/core/config.js';
import type {
  HandoffContext,
  HandoffRouter,
  ContextCompressor,
  TransportLayer,
  AgentCapabilities,
} from '../../../src/types/index.js';
import type { TransportFactory } from '../../../src/transport/transport-factory.js';

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

function createContext(overrides?: Partial<HandoffContext>): HandoffContext {
  return {
    sessionId: 's-1',
    conversationId: 'c-1',
    messages: [],
    trigger: { type: 'confidence_too_low', currentConfidence: 0.4, threshold: 0.6, message: '' },
    userMetadata: { userId: 'u-1', language: 'en' },
    state: { resolvedEntities: {}, openQuestions: [], contextVariables: {} },
    availableAgents: [createAgent()],
    ...overrides,
  };
}

function createMockCompressor(): ContextCompressor {
  return {
    compress: vi.fn().mockResolvedValue({
      summary: 'test',
      keyFacts: [],
      entities: [],
      intents: [],
      openItems: [],
      compressionMethod: 'hybrid',
      originalTokenCount: 10,
      compressedTokenCount: 5,
      compressionRatio: 0.5,
    }),
    estimateTokens: vi.fn().mockReturnValue(10),
  };
}

function createMockRouter(): HandoffRouter {
  return {
    route: vi.fn().mockResolvedValue({
      type: 'primary',
      targetAgent: createAgent(),
      confidence: 0.9,
      alternatives: [],
    }),
  };
}

function createMockTransport(): TransportLayer {
  return {
    name: 'mock',
    priority: 0,
    sendHandoff: vi.fn().mockResolvedValue({
      accepted: true,
      responseCode: 200,
      timestamp: new Date(),
    }),
    validateConnection: vi.fn().mockResolvedValue(true),
    getCapabilities: vi.fn().mockReturnValue({
      supportsStreaming: false,
      supportsCompression: true,
      maxPayloadSizeBytes: 1024 * 1024,
      protocols: ['mock'],
    }),
  };
}

function createMockTransportFactory(): TransportFactory {
  return {
    getTransport: vi.fn().mockReturnValue(createMockTransport()),
    registerTransport: vi.fn(),
    unregisterTransport: vi.fn(),
    checkHealth: vi.fn().mockResolvedValue(true),
  } as unknown as TransportFactory;
}

describe('HandoffManager', () => {
  it('executes a handoff', async () => {
    const config = createHandoffConfig();
    const manager = new HandoffManager(config, {
      router: createMockRouter(),
      compressor: createMockCompressor(),
      transportFactory: createMockTransportFactory(),
    });

    const result = await manager.executeHandoff(createContext());

    expect(result.success).toBe(true);
    expect(result.receivingAgent).toBeDefined();
  });

  it('emits lifecycle events', async () => {
    const config = createHandoffConfig();
    const manager = new HandoffManager(config, {
      router: createMockRouter(),
      compressor: createMockCompressor(),
      transportFactory: createMockTransportFactory(),
    });

    const onStart = vi.fn();
    const onComplete = vi.fn();

    manager.on('handoffStart', onStart);
    manager.on('handoffComplete', onComplete);

    await manager.executeHandoff(createContext());

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('removes event listeners with off', async () => {
    const config = createHandoffConfig();
    const manager = new HandoffManager(config, {
      router: createMockRouter(),
      compressor: createMockCompressor(),
      transportFactory: createMockTransportFactory(),
    });

    const handler = vi.fn();
    manager.on('handoffStart', handler);
    manager.off('handoffStart', handler);

    await manager.executeHandoff(createContext());

    expect(handler).not.toHaveBeenCalled();
  });

  it('supports once() for single-invocation event handlers', async () => {
    const config = createHandoffConfig();
    const manager = new HandoffManager(config, {
      router: createMockRouter(),
      compressor: createMockCompressor(),
      transportFactory: createMockTransportFactory(),
    });

    const handler = vi.fn();
    manager.once('handoffStart', handler);

    await manager.executeHandoff(createContext());

    expect(handler).toHaveBeenCalledTimes(1);

    // Execute again — once() handlers should not fire again
    await manager.executeHandoff(createContext());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stores config', () => {
    const config = createHandoffConfig();
    const manager = new HandoffManager(config, {
      router: createMockRouter(),
      compressor: createMockCompressor(),
      transportFactory: createMockTransportFactory(),
    });

    expect(manager.config).toBe(config);
  });

  it('registers and unregisters agents', () => {
    const config = createHandoffConfig();
    const manager = new HandoffManager(config, {
      router: createMockRouter(),
      compressor: createMockCompressor(),
      transportFactory: createMockTransportFactory(),
    });

    const agent = createAgent({ agentId: 'a-1' });
    manager.registerAgent(agent);

    expect(manager.getRegisteredAgents()).toHaveLength(1);
    expect(manager.getRegisteredAgents()[0]?.agentId).toBe('a-1');

    manager.unregisterAgent('a-1');
    expect(manager.getRegisteredAgents()).toHaveLength(0);
  });

  it('merges registered agents with context availableAgents', async () => {
    const registeredAgent = createAgent({ agentId: 'registered', skills: ['registered-skill'] });
    const contextAgent = createAgent({ agentId: 'context', skills: ['context-skill'] });

    const router = createMockRouter();
    const config = createHandoffConfig();
    const manager = new HandoffManager(config, {
      router,
      compressor: createMockCompressor(),
      transportFactory: createMockTransportFactory(),
    });

    manager.registerAgent(registeredAgent);

    await manager.executeHandoff(createContext({ availableAgents: [contextAgent] }));

    const routeCall = (router.route as Mock).mock.calls[0];
    const passedAgents = (routeCall?.[1] ?? []) as AgentCapabilities[];
    expect(passedAgents).toHaveLength(2);
    expect(passedAgents.map((a) => a.agentId)).toContain('registered');
    expect(passedAgents.map((a) => a.agentId)).toContain('context');
  });

  it('works with default dependencies', () => {
    const config = createHandoffConfig();
    // Providing only transportFactory so executeHandoff can reach transport
    const manager = new HandoffManager(config, {
      transportFactory: createMockTransportFactory(),
    });

    expect(manager.config).toBe(config);
    expect(manager.getRegisteredAgents()).toEqual([]);
  });

  it('works with no dependencies', () => {
    const config = createHandoffConfig();
    const manager = new HandoffManager(config);

    expect(manager.config).toBe(config);
    expect(manager.getRegisteredAgents()).toEqual([]);
  });
});
