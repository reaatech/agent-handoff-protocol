import type {
  AgentCapabilities,
  HandoffPayload,
  HandoffRequest,
  HandoffResponse,
  TransportCapabilities,
  TransportLayer,
} from '@reaatech/agent-handoff';
import { TransportError } from '@reaatech/agent-handoff';
import { pickDefined } from '@reaatech/agent-handoff';
import { validateAgentCapabilitiesManual } from '@reaatech/agent-handoff-validation';

export interface MCPClient {
  callTool(params: {
    serverId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  }): Promise<unknown>;
  ping(serverId: string): Promise<void>;
}

/**
 * MCP (Model Context Protocol) transport.
 *
 * Converts handoff payloads into MCP tool-call arguments and invokes
 * the `accept_handoff` tool on the target agent's MCP server.
 */
export class MCPTransport implements TransportLayer {
  readonly name = 'mcp';
  readonly priority = 1;

  constructor(private readonly mcpClient: MCPClient) {}

  async sendHandoff(request: HandoffRequest): Promise<HandoffResponse> {
    const mcpPayload = this.convertToMCPFormat(request.payload);

    const result = await this.mcpClient.callTool({
      serverId: request.targetAgent.agentId,
      toolName: 'accept_handoff',
      arguments: mcpPayload,
    });

    return this.parseMCPResponse(result);
  }

  async validateConnection(agent: AgentCapabilities): Promise<boolean> {
    try {
      await this.mcpClient.ping(agent.agentId);
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
      protocols: ['mcp'],
    };
  }

  private convertToMCPFormat(payload: HandoffPayload): Record<string, unknown> {
    return {
      handoff_id: payload.handoffId,
      session_id: payload.sessionId,
      compressed_context: payload.compressedContext,
      handoff_reason: payload.handoffReason,
      user_metadata: payload.userMetadata,
      conversation_state: payload.conversationState,
      custom_data: payload.customData,
    };
  }

  private parseMCPResponse(result: unknown): HandoffResponse {
    if (
      typeof result === 'object' &&
      result !== null &&
      'accepted' in result &&
      typeof (result as Record<string, unknown>).accepted === 'boolean'
    ) {
      const obj = result as Record<string, unknown>;
      const responseCode =
        'responseCode' in obj && typeof obj.responseCode === 'number' ? obj.responseCode : 200;
      const message = 'message' in obj && typeof obj.message === 'string' ? obj.message : undefined;

      return {
        accepted: obj.accepted as boolean,
        responseCode,
        timestamp: new Date(),
        ...pickDefined({
          message,
          receivingAgent: this.parseReceivingAgent(obj.receivingAgent),
        }),
      };
    }
    throw new TransportError('Invalid MCP response format', { result });
  }

  private parseReceivingAgent(value: unknown): AgentCapabilities | undefined {
    if (typeof value !== 'object' || value === null) return undefined;
    const result = validateAgentCapabilitiesManual(value as AgentCapabilities);
    return result.isValid ? (value as AgentCapabilities) : undefined;
  }
}
