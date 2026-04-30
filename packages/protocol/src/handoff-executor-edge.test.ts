import { HandoffError } from '@reaatech/agent-handoff';
import { TypedEventEmitter } from '@reaatech/agent-handoff';
import type {
  AgentCapabilities,
  ContextCompressor,
  HandoffContext,
  HandoffRequest,
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

describe('HandoffExecutor edge cases', () => {
  it('handles fallback routing decision', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();

    const router = createMockRouter({
      type: 'fallback',
      reason: 'no_match',
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
    expect(result.routingDecision.type).toBe('fallback');
  });

  it('handles transport errors gracefully', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();
    const onError = vi.fn();
    emitter.on('handoffError', onError);

    const transport = createMockTransport({
      sendHandoff: vi.fn().mockRejectedValue(new Error('Network error')),
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
    expect(result.error).toBeDefined();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('handles alternative transport errors and continues', async () => {
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
      sendHandoff: vi.fn().mockRejectedValue(new Error('Network error')),
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

    expect(result.success).toBe(false);
    expect(vi.mocked(primaryTransport).sendHandoff).toHaveBeenCalledTimes(1);
    expect(vi.mocked(altTransport).sendHandoff).toHaveBeenCalledTimes(1);
  });

  it('handles empty availableAgents array', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();
    const executor = new HandoffExecutor(
      createMockRouter(),
      createMockCompressor(),
      new HandoffValidator(),
      createMockTransportFactory(),
      emitter,
    );

    const result = await executor.executeHandoff(createContext({ availableAgents: [] }));
    // Router gets empty array, should handle it
    expect(result).toBeDefined();
  });

  it('wraps non-HandoffError in HandoffError', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();
    const onError = vi.fn();
    emitter.on('handoffError', onError);

    const compressor = createMockCompressor();
    compressor.compress = vi.fn().mockRejectedValue(new Error('compression failed'));

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

  it('preserves HandoffError in catch block', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();
    const onError = vi.fn();
    emitter.on('handoffError', onError);

    const router = createMockRouter();
    router.route = vi.fn().mockRejectedValue(new HandoffError('router failed', 'routing_error'));

    const executor = new HandoffExecutor(
      router,
      createMockCompressor(),
      new HandoffValidator(),
      createMockTransportFactory(),
      emitter,
    );

    const result = await executor.executeHandoff(createContext());

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(HandoffError);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.error?.code).toBe('routing_error');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('wraps non-Error thrown values', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();
    const onError = vi.fn();
    emitter.on('handoffError', onError);

    const router = createMockRouter();
    router.route = vi.fn().mockRejectedValue('string error');

    const executor = new HandoffExecutor(
      router,
      createMockCompressor(),
      new HandoffValidator(),
      createMockTransportFactory(),
      emitter,
    );

    const result = await executor.executeHandoff(createContext());

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(HandoffError);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('passes timeout in options', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();
    const transport = createMockTransport();
    const factory = createMockTransportFactory(transport);

    const executor = new HandoffExecutor(
      createMockRouter(),
      createMockCompressor(),
      new HandoffValidator(),
      factory,
      emitter,
    );

    await executor.executeHandoff(createContext(), { timeout: 5000 });

    expect(vi.mocked(transport).sendHandoff).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it('passes expiresAt in payload', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();
    const transport = createMockTransport();
    const factory = createMockTransportFactory(transport);

    const executor = new HandoffExecutor(
      createMockRouter(),
      createMockCompressor(),
      new HandoffValidator(),
      factory,
      emitter,
    );

    const expiresAt = new Date(Date.now() + 60000);
    await executor.executeHandoff(createContext(), { expiresAt });

    expect(vi.mocked(transport).sendHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ expiresAt }) as Record<string, unknown>,
      }),
    );
  });

  it('passes all options through rejection alternatives', async () => {
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
      sendHandoff: vi.fn().mockResolvedValue({ accepted: false, responseCode: 503 }),
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

    const result = await executor.executeHandoff(createContext(), {
      sourceAgent: createAgent({ agentId: 'src-1' }),
      timeout: 5000,
      requireExplicitAcceptance: false,
    });

    expect(result.success).toBe(false);
    const call = vi.mocked(altTransport).sendHandoff.mock.calls[0]?.[0] as HandoffRequest;
    expect(call.sourceAgent).toMatchObject({ agentId: 'src-1' });
    expect(call.timeout).toBe(5000);
    expect(call.requireExplicitAcceptance).toBe(false);
  });

  it('uses default rejection reason when response message is missing', async () => {
    const emitter = new TypedEventEmitter<HandoffEventMap>();
    const altAgent = createAgent({ agentId: 'agent-2' });

    const router = createMockRouter({
      type: 'primary',
      targetAgent: createAgent(),
      confidence: 0.9,
      alternatives: [altAgent],
    });

    const primaryTransport = createMockTransport({
      sendHandoff: vi.fn().mockResolvedValue({ accepted: false, responseCode: 503 }),
    });
    const altTransport = createMockTransport({
      sendHandoff: vi.fn().mockResolvedValue({ accepted: false, responseCode: 503 }),
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

    expect(result.success).toBe(false);
    expect(result.rejectionReason).toBe('all_agents_rejected');
  });
});
