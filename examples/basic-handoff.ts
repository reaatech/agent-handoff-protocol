/**
 * Basic Handoff Setup
 *
 * This example shows the simplest way to configure and execute a handoff
 * between two agents using the default HybridCompressor and CapabilityBasedRouter.
 */

import {
  HandoffManager,
  createHandoffConfig,
  HybridCompressor,
  CapabilityBasedRouter,
  TransportFactory,
  MCPTransport,
} from '@reaatech/agent-handoff-protocol';

// 1. Create your MCP client (from @modelcontextprotocol/sdk or your own)
const mcpClient = {
  async callTool(params: {
    serverId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  }) {
    // Your MCP implementation here
    console.log('Calling tool', params.toolName, 'on', params.serverId);
    return { accepted: true, responseCode: 200 };
  },
  async ping(serverId: string) {
    console.log('Pinging', serverId);
  },
};

// 2. Build the transport layer
const mcpTransport = new MCPTransport(mcpClient);
const transportFactory = new TransportFactory([mcpTransport]);

// 3. Create configuration with sensible defaults
const config = createHandoffConfig({
  routing: {
    minConfidenceThreshold: 0.6,
    policy: 'best_effort',
  },
});

// 4. Wire up the manager
const manager = new HandoffManager(config, {
  router: new CapabilityBasedRouter(config.routing),
  compressor: new HybridCompressor(),
  transportFactory,
});

// 5. Register agents that are always available
manager.registerAgent({
  agentId: 'ts-agent',
  agentName: 'TypeScript Specialist',
  skills: ['typescript', 'architecture'],
  domains: ['frontend', 'backend'],
  maxConcurrentSessions: 5,
  currentLoad: 1,
  languages: ['en'],
  specializations: [],
  availability: 'available',
  version: '1.0.0',
});

// 6. Execute a handoff
async function run() {
  manager.on('handoffStart', (evt) => console.log('→ Handoff started:', evt.handoffId));
  manager.on('handoffComplete', (evt) => console.log('✓ Handoff complete:', evt.duration, 'ms'));
  manager.on('handoffError', (evt) => console.error('✗ Handoff error:', evt.error.message));

  const result = await manager.executeHandoff({
    sessionId: 'session-123',
    conversationId: 'conv-456',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'How do I define a generic interface?',
        timestamp: new Date(),
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'You can use the `interface` keyword with type parameters.',
        timestamp: new Date(),
      },
    ],
    trigger: {
      type: 'specialist_required',
      requiredSkills: ['typescript'],
      currentAgentSkills: [],
    },
    userMetadata: { userId: 'user-789', language: 'en' },
    state: { resolvedEntities: {}, openQuestions: [], contextVariables: {} },
    availableAgents: [], // registered agents are included automatically
  });

  console.log('Result:', result.success ? 'Accepted' : 'Rejected');
}

run().catch(console.error);
