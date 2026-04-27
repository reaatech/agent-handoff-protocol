import { describe, it, expect, vi } from 'vitest';
import { MCPTransport } from '../../../src/transport/mcp-transport.js';
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

describe('MCPTransport', () => {
  it('sends handoff and parses accepted response', async () => {
    const mockClient = {
      callTool: vi.fn().mockResolvedValue({ accepted: true, responseCode: 200 }),
      ping: vi.fn().mockResolvedValue(undefined),
    };

    const transport = new MCPTransport(mockClient);
    const result = await transport.sendHandoff(createRequest());

    expect(result.accepted).toBe(true);
    expect(result.responseCode).toBe(200);
    expect(mockClient.callTool).toHaveBeenCalledWith({
      serverId: 'agent-1',
      toolName: 'accept_handoff',
      arguments: expect.objectContaining({
        handoff_id: 'h-1',
        session_id: 's-1',
      }) as Record<string, unknown>,
    });
  });

  it('sends handoff and parses rejected response', async () => {
    const mockClient = {
      callTool: vi.fn().mockResolvedValue({ accepted: false, responseCode: 503, message: 'busy' }),
      ping: vi.fn().mockResolvedValue(undefined),
    };

    const transport = new MCPTransport(mockClient);
    const result = await transport.sendHandoff(createRequest());

    expect(result.accepted).toBe(false);
    expect(result.responseCode).toBe(503);
  });

  it('validates connection successfully', async () => {
    const mockClient = {
      callTool: vi.fn(),
      ping: vi.fn().mockResolvedValue(undefined),
    };

    const transport = new MCPTransport(mockClient);
    const result = await transport.validateConnection(createAgent());

    expect(result).toBe(true);
  });

  it('validates connection failure', async () => {
    const mockClient = {
      callTool: vi.fn(),
      ping: vi.fn().mockRejectedValue(new Error('timeout')),
    };

    const transport = new MCPTransport(mockClient);
    const result = await transport.validateConnection(createAgent());

    expect(result).toBe(false);
  });

  it('throws on invalid response format', async () => {
    const mockClient = {
      callTool: vi.fn().mockResolvedValue({ invalid: true }),
      ping: vi.fn(),
    };

    const transport = new MCPTransport(mockClient);
    await expect(transport.sendHandoff(createRequest())).rejects.toThrow(
      'Invalid MCP response format'
    );
  });

  it('defaults responseCode to 200 when missing', async () => {
    const mockClient = {
      callTool: vi.fn().mockResolvedValue({ accepted: true }),
      ping: vi.fn(),
    };

    const transport = new MCPTransport(mockClient);
    const result = await transport.sendHandoff(createRequest());

    expect(result.accepted).toBe(true);
    expect(result.responseCode).toBe(200);
  });

  it('passes through a valid receivingAgent', async () => {
    const validAgent = createAgent({ agentId: 'agent-2', agentName: 'Receiver' });
    const mockClient = {
      callTool: vi.fn().mockResolvedValue({
        accepted: true,
        responseCode: 200,
        receivingAgent: validAgent,
      }),
      ping: vi.fn(),
    };

    const transport = new MCPTransport(mockClient);
    const result = await transport.sendHandoff(createRequest());

    expect(result.receivingAgent?.agentId).toBe('agent-2');
  });

  it('drops an invalid receivingAgent shape', async () => {
    const mockClient = {
      callTool: vi.fn().mockResolvedValue({
        accepted: true,
        responseCode: 200,
        receivingAgent: { agentId: '', agentName: 'missing fields' },
      }),
      ping: vi.fn(),
    };

    const transport = new MCPTransport(mockClient);
    const result = await transport.sendHandoff(createRequest());

    expect(result.receivingAgent).toBeUndefined();
  });

  it('returns correct capabilities', () => {
    const transport = new MCPTransport({ callTool: vi.fn(), ping: vi.fn() });
    const caps = transport.getCapabilities();

    expect(caps.supportsStreaming).toBe(false);
    expect(caps.supportsCompression).toBe(true);
    expect(caps.protocols).toContain('mcp');
  });
});
