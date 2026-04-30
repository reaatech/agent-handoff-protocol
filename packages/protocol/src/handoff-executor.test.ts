import { TypedEventEmitter } from '@reaatech/agent-handoff';
import type {
  AgentCapabilities,
  ContextCompressor,
  HandoffContext,
  HandoffRouter,
  RoutingDecision,
  TransportLayer,
} from '@reaatech/agent-handoff';
import type { TransportFactory } from '@reaatech/agent-handoff-transport';
import { HandoffValidator } from '@reaatech/agent-handoff-validation';
import { describe, expect, it, vi } from 'vitest';
import { HandoffExecutor } from './handoff-executor.js';
import type { HandoffEventMap } from './handoff-manager.js';

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
      summary: 'test summary',
      keyFacts: [],
      entities: [],
      intents: [],
      openItems: [],
      compressionMethod: 'hybrid',
      originalTokenCount: 100,
      compressedTokenCount: 50,
      compressionRatio: 0.5,
    }),
    estimateTokens: vi.fn().mockReturnValue(10),
  };
}

function createMockRouter(decision?: RoutingDecision): HandoffRouter {
  return {
    route: vi.fn().mockResolvedValue(
      decision ??
        ({
          type: 'primary',
          targetAgent: createAgent(),
          confidence: 0.9,
          alternatives: [],
        } as RoutingDecision),
    ),
  };
}

function createMockTransport(overrides?: Partial<TransportLayer>) {
  const sendHandoff = vi.fn().mockResolvedValue({
    accepted: true,
    responseCode: 200,
    timestamp: new Date(),
  });
  const validateConnection = vi.fn().mockResolvedValue(true);
  const getCapabilities = vi.fn().mockReturnValue({
    supportsStreaming: false,
    supportsCompression: true,
    maxPayloadSizeBytes: 1024 * 1024,
    protocols: ['mock'],
  });

  return {
    name: 'mock',
    priority: 0,
    sendHandoff,
    validateConnection,
    getCapabilities,
    ...overrides,
  };
}

function createMockTransportFactory(transport?: TransportLayer): TransportFactory {
  return {
    getTransport: vi.fn().mockReturnValue(transport ?? createMockTransport()),
    registerTransport: vi.fn(),
    unregisterTransport: vi.fn(),
    checkHealth: vi.fn().mockResolvedValue(true),
  } as unknown as TransportFactory;
}

describe('HandoffExecutor', () => {
  it('executes successful handoff', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();
    const onComplete = vi.fn();
    emitter.on('handoffComplete', onComplete);

    const executor = new HandoffExecutor(
      createMockRouter(),
      createMockCompressor(),
      new HandoffValidator(),
      createMockTransportFactory(),
      emitter,
    );

    const result = await executor.executeHandoff(createContext());

    expect(result.success).toBe(true);
    expect(result.receivingAgent).toBeDefined();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('emits handoffStart event', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();
    const onStart = vi.fn();
    emitter.on('handoffStart', onStart);

    const executor = new HandoffExecutor(
      createMockRouter(),
      createMockCompressor(),
      new HandoffValidator(),
      createMockTransportFactory(),
      emitter,
    );

    await executor.executeHandoff(createContext());
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 's-1',
      }),
    );
  });

  it('handles rejection and tries alternatives', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();
    const altAgent = createAgent({ agentId: 'agent-2' });

    const router = createMockRouter({
      type: 'primary',
      targetAgent: createAgent(),
      confidence: 0.9,
      alternatives: [altAgent],
    });

    const primaryTransport = createMockTransport({
      sendHandoff: vi
        .fn()
        .mockResolvedValue({ accepted: false, responseCode: 503, message: 'busy' }),
    });
    const altTransport = createMockTransport({
      sendHandoff: vi
        .fn()
        .mockResolvedValue({ accepted: true, responseCode: 200, timestamp: new Date() }),
    });

    const transportFactory = {
      getTransport: vi.fn().mockReturnValueOnce(primaryTransport).mockReturnValueOnce(altTransport),
      registerTransport: vi.fn(),
      unregisterTransport: vi.fn(),
      checkHealth: vi.fn(),
    } as unknown as TransportFactory;

    const executor = new HandoffExecutor(
      router,
      createMockCompressor(),
      new HandoffValidator(),
      transportFactory,
      emitter,
    );

    const result = await executor.executeHandoff(createContext());

    expect(result.success).toBe(true);
    expect(vi.mocked(primaryTransport).sendHandoff).toHaveBeenCalledTimes(1);
    expect(vi.mocked(altTransport).sendHandoff).toHaveBeenCalledTimes(1);
  });

  it('returns fallback when all agents reject', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();
    const onReject = vi.fn();
    emitter.on('handoffReject', onReject);

    const transport = createMockTransport({
      sendHandoff: vi
        .fn()
        .mockResolvedValue({ accepted: false, responseCode: 503, message: 'all busy' }),
    });

    const executor = new HandoffExecutor(
      createMockRouter(),
      createMockCompressor(),
      new HandoffValidator(),
      createMockTransportFactory(transport),
      emitter,
    );

    const result = await executor.executeHandoff(createContext());

    expect(result.success).toBe(false);
    expect(result.rejectionReason).toBe('all busy');
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('returns clarification route when ambiguous', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();

    const router = createMockRouter({
      type: 'clarification',
      candidateAgents: [createAgent()],
      clarificationQuestions: ['Which one?'],
      recommendedAction: 'ask_user',
    });

    const executor = new HandoffExecutor(
      router,
      createMockCompressor(),
      new HandoffValidator(),
      createMockTransportFactory(),
      emitter,
    );

    const result = await executor.executeHandoff(createContext());

    expect(result.success).toBe(false);
    expect(result.routingDecision.type).toBe('clarification');
  });

  it('handles compression errors gracefully', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();
    const onError = vi.fn();
    emitter.on('handoffError', onError);

    const compressor = createMockCompressor();
    compressor.compress = vi.fn().mockRejectedValue(new Error('Compression failed'));

    const executor = new HandoffExecutor(
      createMockRouter(),
      compressor,
      new HandoffValidator(),
      createMockTransportFactory(),
      emitter,
    );

    const result = await executor.executeHandoff(createContext());

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('handles validation failure', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();

    const validator = new HandoffValidator();
    validator.validatePayload = vi.fn().mockResolvedValue({
      isValid: false,
      errors: ['Payload too large'],
    });

    const executor = new HandoffExecutor(
      createMockRouter(),
      createMockCompressor(),
      validator,
      createMockTransportFactory(),
      emitter,
    );

    const result = await executor.executeHandoff(createContext());

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('validation_error');
  });
});
