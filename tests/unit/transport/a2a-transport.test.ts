import { describe, it, expect, vi } from 'vitest';
import { A2ATransport } from '../../../src/transport/a2a-transport.js';
import type { AgentCapabilities, HandoffRequest } from '../../../src/types/index.js';

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
    metadata: { endpoint: 'https://agent-1.example.com' },
    ...overrides,
  };
}

function createRequest(overrides?: Partial<HandoffRequest>): HandoffRequest {
  return {
    payload: {
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
    },
    targetAgent: createAgent(),
    ...overrides,
  };
}

describe('A2ATransport', () => {
  it('sends handoff via POST', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({
        data: { accepted: true, responseCode: 200, timestamp: new Date() },
      }),
    };

    const transport = new A2ATransport(mockClient);
    const result = await transport.sendHandoff(createRequest());

    expect(result.accepted).toBe(true);
    expect(mockClient.post).toHaveBeenCalledWith(
      'https://agent-1.example.com/handoffs',
      expect.objectContaining({
        payload: expect.any(Object) as object,
        timestamp: expect.any(String) as string,
      }),
      expect.any(Object)
    );
  });

  it('throws when agent has no endpoint', async () => {
    const mockClient = { get: vi.fn(), post: vi.fn() };
    const transport = new A2ATransport(mockClient);
    const request = createRequest({ targetAgent: createAgent({ metadata: {} }) });

    await expect(transport.sendHandoff(request)).rejects.toThrow('no A2A endpoint configured');
  });

  it('retries on network error', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValue({ data: { accepted: true, responseCode: 200, timestamp: new Date() } }),
    };

    const transport = new A2ATransport(mockClient);
    const result = await transport.sendHandoff(createRequest());

    expect(result.accepted).toBe(true);
    expect(mockClient.post).toHaveBeenCalledTimes(2);
  });

  it('validates connection via health endpoint', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn(),
    };

    const transport = new A2ATransport(mockClient);
    const result = await transport.validateConnection(createAgent());

    expect(result).toBe(true);
    expect(mockClient.get).toHaveBeenCalledWith('https://agent-1.example.com/health', {
      timeout: 5000,
    });
  });

  it('includes auth headers when provided', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({
        data: { accepted: true, responseCode: 200, timestamp: new Date() },
      }),
    };

    const transport = new A2ATransport(mockClient, { Authorization: 'Bearer token' });
    await transport.sendHandoff(createRequest());

    expect(mockClient.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
      })
    );
  });

  it('returns correct capabilities', () => {
    const transport = new A2ATransport({ get: vi.fn(), post: vi.fn() });
    const caps = transport.getCapabilities();

    expect(caps.supportsStreaming).toBe(false);
    expect(caps.supportsCompression).toBe(true);
    expect(caps.maxPayloadSizeBytes).toBe(50 * 1024 * 1024);
  });

  it('retries on ETIMEDOUT network error', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue({ data: { accepted: true, responseCode: 200, timestamp: new Date() } }),
    };

    const transport = new A2ATransport(mockClient);
    const result = await transport.sendHandoff(createRequest());

    expect(result.accepted).toBe(true);
    expect(mockClient.post).toHaveBeenCalledTimes(2);
  });

  it('retries on fetch failed network error', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi
        .fn()
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValue({ data: { accepted: true, responseCode: 200, timestamp: new Date() } }),
    };

    const transport = new A2ATransport(mockClient);
    const result = await transport.sendHandoff(createRequest());

    expect(result.accepted).toBe(true);
    expect(mockClient.post).toHaveBeenCalledTimes(2);
  });

  it('retries on server error (5xx)', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi
        .fn()
        .mockRejectedValueOnce(new Error('500 Internal Server Error'))
        .mockResolvedValue({ data: { accepted: true, responseCode: 200, timestamp: new Date() } }),
    };

    const transport = new A2ATransport(mockClient);
    const result = await transport.sendHandoff(createRequest());

    expect(result.accepted).toBe(true);
    expect(mockClient.post).toHaveBeenCalledTimes(2);
  });

  it('returns false from validateConnection on error', async () => {
    const mockClient = {
      get: vi.fn().mockRejectedValue(new Error('Network error')),
      post: vi.fn(),
    };

    const transport = new A2ATransport(mockClient);
    const result = await transport.validateConnection(createAgent());

    expect(result).toBe(false);
    expect(mockClient.get).toHaveBeenCalledWith('https://agent-1.example.com/health', {
      timeout: 5000,
    });
  });

  it('throws on non-object response data', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({ data: 'not-an-object' }),
    };

    const transport = new A2ATransport(mockClient);
    await expect(transport.sendHandoff(createRequest())).rejects.toThrow('expected object');
  });

  it('throws when response lacks accepted boolean', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({ data: { responseCode: 200 } }),
    };

    const transport = new A2ATransport(mockClient);
    await expect(transport.sendHandoff(createRequest())).rejects.toThrow('accepted boolean');
  });

  it('parses minimal valid response with default timestamp', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({ data: { accepted: false, responseCode: 503 } }),
    };

    const transport = new A2ATransport(mockClient);
    const result = await transport.sendHandoff(createRequest());

    expect(result.accepted).toBe(false);
    expect(result.responseCode).toBe(503);
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('retries when error has 5xx status property', async () => {
    const err = Object.assign(new Error('boom'), { status: 502 });
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi
        .fn()
        .mockRejectedValueOnce(err)
        .mockResolvedValue({ data: { accepted: true, responseCode: 200, timestamp: new Date() } }),
    };

    const transport = new A2ATransport(mockClient);
    const result = await transport.sendHandoff(createRequest());

    expect(result.accepted).toBe(true);
    expect(mockClient.post).toHaveBeenCalledTimes(2);
  });

  it('does not retry when error has non-5xx status property', async () => {
    const err = Object.assign(new Error('bad request'), { status: 400 });
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockRejectedValue(err),
    };

    const transport = new A2ATransport(mockClient);
    await expect(transport.sendHandoff(createRequest())).rejects.toThrow('bad request');
    expect(mockClient.post).toHaveBeenCalledTimes(1);
  });

  it('passes through a valid receivingAgent', async () => {
    const validAgent = createAgent({ agentId: 'agent-2', agentName: 'Receiver' });
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({
        data: {
          accepted: true,
          responseCode: 200,
          timestamp: new Date(),
          receivingAgent: validAgent,
        },
      }),
    };

    const transport = new A2ATransport(mockClient);
    const result = await transport.sendHandoff(createRequest());

    expect(result.receivingAgent?.agentId).toBe('agent-2');
  });

  it('drops an invalid receivingAgent shape', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({
        data: {
          accepted: true,
          responseCode: 200,
          timestamp: new Date(),
          receivingAgent: { agentId: '', agentName: 'missing fields' },
        },
      }),
    };

    const transport = new A2ATransport(mockClient);
    const result = await transport.sendHandoff(createRequest());

    expect(result.receivingAgent).toBeUndefined();
  });

  it('parses response with numeric timestamp fallback', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({
        data: { accepted: true, responseCode: 200, timestamp: 12345 },
      }),
    };

    const transport = new A2ATransport(mockClient);
    const result = await transport.sendHandoff(createRequest());

    expect(result.accepted).toBe(true);
    expect(result.timestamp).toBeInstanceOf(Date);
  });
});
