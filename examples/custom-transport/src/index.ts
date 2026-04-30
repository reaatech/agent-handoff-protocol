/**
 * Custom Transport Layer
 *
 * This example shows how to implement a custom TransportLayer
 * that sends handoffs via an in-memory message bus.
 */

import type {
  AgentCapabilities,
  HandoffRequest,
  HandoffResponse,
  TransportCapabilities,
  TransportLayer,
} from '@reaatech/agent-handoff-protocol';

export interface MessageBus {
  send(channel: string, payload: unknown): Promise<void>;
  receive(channel: string): Promise<unknown>;
}

export class MessageBusTransport implements TransportLayer {
  readonly name = 'message_bus';
  readonly priority = 5;

  constructor(private readonly bus: MessageBus) {}

  async sendHandoff(request: HandoffRequest): Promise<HandoffResponse> {
    await this.bus.send(`agent:${request.targetAgent.agentId}`, {
      payload: request.payload,
      sourceAgent: request.sourceAgent,
      requireExplicitAcceptance: request.requireExplicitAcceptance,
      timestamp: new Date().toISOString(),
    });

    const response = await this.bus.receive(`agent:${request.targetAgent.agentId}:response`);

    if (typeof response === 'object' && response !== null && 'accepted' in response) {
      return response as HandoffResponse;
    }

    throw new Error('Invalid response from message bus');
  }

  async validateConnection(agent: AgentCapabilities): Promise<boolean> {
    try {
      await this.bus.send(`agent:${agent.agentId}:ping`, {});
      return true;
    } catch {
      return false;
    }
  }

  getCapabilities(): TransportCapabilities {
    return {
      supportsStreaming: false,
      supportsCompression: true,
      maxPayloadSizeBytes: 10 * 1024 * 1024,
      protocols: ['message_bus'],
    };
  }
}
