import { describe, it, expect, vi } from 'vitest';
import { TransportFactory } from '../../../src/transport/transport-factory.js';
import type { TransportLayer, AgentCapabilities } from '../../../src/types/index.js';

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

describe('TransportFactory', () => {
  it('selects transport by priority', () => {
    const mcp = createMockTransport({ name: 'mcp', priority: 1 });
    const a2a = createMockTransport({ name: 'a2a', priority: 2 });
    const factory = new TransportFactory([mcp, a2a]);

    const transport = factory.getTransport(createAgent(), 'auto');
    expect(transport.name).toBe('a2a');
  });

  it('selects preferred transport when specified', () => {
    const mcp = createMockTransport({ name: 'mcp', priority: 1 });
    const a2a = createMockTransport({ name: 'a2a', priority: 2 });
    const factory = new TransportFactory([mcp, a2a]);

    const transport = factory.getTransport(createAgent(), 'a2a');
    expect(transport.name).toBe('a2a');
  });

  it('throws when no transport is available', () => {
    const factory = new TransportFactory([]);
    expect(() => factory.getTransport(createAgent())).toThrow('No healthy transport available');
  });

  it('returns false when checking health of non-existent transport', async () => {
    const factory = new TransportFactory([]);
    const result = await factory.checkHealth(createAgent(), 'nonexistent');
    expect(result).toBe(false);
  });

  it('registers and unregisters transports dynamically', () => {
    const factory = new TransportFactory([]);
    const transport = createMockTransport({ name: 'ws', priority: 3 });

    factory.registerTransport(transport);
    expect(factory.getTransport(createAgent()).name).toBe('ws');

    factory.unregisterTransport('ws');
    expect(() => factory.getTransport(createAgent())).toThrow();
  });

  it('checks health and caches results', async () => {
    const mockTransport = createMockTransport({
      validateConnection: vi.fn().mockResolvedValue(true),
    });
    const factory = new TransportFactory([mockTransport], { healthTtlMs: 30000 });

    const healthy = await factory.checkHealth(createAgent(), 'mock');
    expect(healthy).toBe(true);
    expect(vi.mocked(mockTransport).validateConnection).toHaveBeenCalledTimes(1);
  });

  it('skips unhealthy cached transport and falls back', async () => {
    const unhealthyTransport = createMockTransport({
      name: 'unhealthy',
      priority: 2,
      validateConnection: vi.fn().mockResolvedValue(false),
    });
    const healthyTransport = createMockTransport({ name: 'healthy', priority: 1 });
    const factory = new TransportFactory([unhealthyTransport, healthyTransport], {
      healthTtlMs: 30000,
    });

    // Seed cache with unhealthy entry
    await factory.checkHealth(createAgent(), 'unhealthy');

    // When auto-selecting, it should try unhealthy first (higher priority), skip it due to cache, then pick healthy
    const transport = factory.getTransport(createAgent(), 'auto');
    expect(transport.name).toBe('healthy');
  });

  it('throws when preferred transport is unhealthy and no alternatives exist', async () => {
    const unhealthyTransport = createMockTransport({
      name: 'unhealthy',
      priority: 1,
      validateConnection: vi.fn().mockResolvedValue(false),
    });
    const factory = new TransportFactory([unhealthyTransport], { healthTtlMs: 30000 });

    await factory.checkHealth(createAgent(), 'unhealthy');
    expect(() => factory.getTransport(createAgent(), 'auto')).toThrow(
      'No healthy transport available'
    );
  });

  it('clears health cache on unregister', async () => {
    const mockTransport = createMockTransport({ name: 'test' });
    const factory = new TransportFactory([mockTransport]);

    await factory.checkHealth(createAgent({ agentId: 'a1' }), 'test');
    factory.unregisterTransport('test');

    expect(() => factory.getTransport(createAgent())).toThrow();
  });
});
