import { createHandoffConfig } from '@reaatech/agent-handoff';
import type { AgentCapabilities, CompressedContext, HandoffContext } from '@reaatech/agent-handoff';
import { HybridCompressor } from '@reaatech/agent-handoff-compression';
import { CapabilityBasedRouter } from '@reaatech/agent-handoff-routing';
import { TransportFactory } from '@reaatech/agent-handoff-transport';
import { MCPTransport } from '@reaatech/agent-handoff-transport';
import { A2ATransport } from '@reaatech/agent-handoff-transport';
import { describe, expect, it, vi } from 'vitest';
import { HandoffManager } from './handoff-manager.js';

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
    messages: [
      {
        id: 'm-1',
        role: 'user',
        content: 'Hello, I need help with TypeScript',
        timestamp: new Date(),
      },
      { id: 'm-2', role: 'assistant', content: 'Sure, what do you need?', timestamp: new Date() },
    ],
    trigger: { type: 'confidence_too_low', currentConfidence: 0.4, threshold: 0.6, message: '' },
    userMetadata: { userId: 'u-1', language: 'en' },
    state: { resolvedEntities: {}, openQuestions: [], contextVariables: {} },
    availableAgents: [createAgent()],
    ...overrides,
  };
}

describe('Handoff Lifecycle Integration', () => {
  it('executes successful end-to-end handoff via MCP', async () => {
    const mcpClient = {
      callTool: vi.fn().mockResolvedValue({ accepted: true, responseCode: 200 }),
      ping: vi.fn().mockResolvedValue(undefined),
    };

    const mcpTransport = new MCPTransport(mcpClient);
    const factory = new TransportFactory([mcpTransport]);
    const config = createHandoffConfig();

    const manager = new HandoffManager(config, {
      router: new CapabilityBasedRouter(config.routing),
      compressor: new HybridCompressor(),
      transportFactory: factory,
    });

    const result = await manager.executeHandoff(createContext());

    expect(result.success).toBe(true);
    expect(result.receivingAgent).toBeDefined();
    expect(mcpClient.callTool).toHaveBeenCalledTimes(1);
  });

  it('executes successful end-to-end handoff via A2A', async () => {
    const httpClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({
        data: { accepted: true, responseCode: 200, timestamp: new Date().toISOString() },
      }),
    };

    const a2aTransport = new A2ATransport(httpClient);
    const factory = new TransportFactory([a2aTransport]);
    const config = createHandoffConfig();

    const manager = new HandoffManager(config, {
      router: new CapabilityBasedRouter(config.routing),
      compressor: new HybridCompressor(),
      transportFactory: factory,
    });

    const agent = createAgent({ metadata: { endpoint: 'https://agent.example.com' } });
    const result = await manager.executeHandoff(createContext({ availableAgents: [agent] }));

    expect(result.success).toBe(true);
    expect(result.receivingAgent).toBeDefined();
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('handles rejection and falls back to alternative agent', async () => {
    const primaryAgent = createAgent({ agentId: 'primary', skills: ['typescript'] });
    const altAgent = createAgent({ agentId: 'alt', skills: ['typescript'] });

    let callCount = 0;
    const mcpClient = {
      callTool: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ accepted: false, responseCode: 503, message: 'busy' });
        }
        return Promise.resolve({ accepted: true, responseCode: 200 });
      }),
      ping: vi.fn().mockResolvedValue(undefined),
    };

    const mcpTransport = new MCPTransport(mcpClient);
    const factory = new TransportFactory([mcpTransport]);
    const config = createHandoffConfig({ routing: { maxAlternatives: 2 } });

    const manager = new HandoffManager(config, {
      router: new CapabilityBasedRouter(config.routing),
      compressor: new HybridCompressor(),
      transportFactory: factory,
    });

    const result = await manager.executeHandoff(
      createContext({ availableAgents: [primaryAgent, altAgent] }),
    );

    expect(result.success).toBe(true);
    expect(callCount).toBe(2);
  });

  it('emits lifecycle events during handoff', async () => {
    const mcpClient = {
      callTool: vi.fn().mockResolvedValue({ accepted: true, responseCode: 200 }),
      ping: vi.fn().mockResolvedValue(undefined),
    };

    const mcpTransport = new MCPTransport(mcpClient);
    const factory = new TransportFactory([mcpTransport]);
    const config = createHandoffConfig();

    const manager = new HandoffManager(config, {
      router: new CapabilityBasedRouter(config.routing),
      compressor: new HybridCompressor(),
      transportFactory: factory,
    });

    const events: string[] = [];
    manager.on('handoffStart', () => events.push('start'));
    manager.on('handoffComplete', () => events.push('complete'));

    await manager.executeHandoff(createContext());

    expect(events).toEqual(['start', 'complete']);
  });

  it('produces valid compressed context in payload', async () => {
    const mcpClient = {
      callTool: vi.fn().mockImplementation((params: unknown) => {
        const args = (params as Record<string, unknown>).arguments as Record<string, unknown>;
        const compressedContext = args.compressed_context as CompressedContext;

        expect(compressedContext.summary).toBeTruthy();
        expect(compressedContext.compressionMethod).toBe('hybrid');
        expect(compressedContext.originalTokenCount).toBeGreaterThanOrEqual(0);
        expect(compressedContext.compressedTokenCount).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(compressedContext.keyFacts)).toBe(true);
        expect(Array.isArray(compressedContext.entities)).toBe(true);

        return { accepted: true, responseCode: 200 };
      }),
      ping: vi.fn().mockResolvedValue(undefined),
    };

    const mcpTransport = new MCPTransport(mcpClient);
    const factory = new TransportFactory([mcpTransport]);
    const config = createHandoffConfig();

    const manager = new HandoffManager(config, {
      router: new CapabilityBasedRouter(config.routing),
      compressor: new HybridCompressor(),
      transportFactory: factory,
    });

    const result = await manager.executeHandoff(createContext());
    expect(result.success).toBe(true);
  });

  it('times out when transport is unresponsive', async () => {
    const httpClient = {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => {
              reject(new Error('ETIMEDOUT'));
            }, 100),
          ),
      ),
    };

    const a2aTransport = new A2ATransport(httpClient);
    const factory = new TransportFactory([a2aTransport]);
    const config = createHandoffConfig();

    const manager = new HandoffManager(config, {
      router: new CapabilityBasedRouter(config.routing),
      compressor: new HybridCompressor(),
      transportFactory: factory,
    });

    const agent = createAgent({ metadata: { endpoint: 'https://slow.example.com' } });
    const result = await manager.executeHandoff(createContext({ availableAgents: [agent] }), {
      timeout: 50,
    });

    expect(result.success).toBe(false);
  });
});
