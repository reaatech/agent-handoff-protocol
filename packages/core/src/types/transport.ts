import type { HandoffPayload } from './payload.js';
import type { AgentCapabilities } from './routing.js';

export interface TransportLayer {
  readonly name: string;
  readonly priority: number;

  sendHandoff(request: HandoffRequest): Promise<HandoffResponse>;
  validateConnection(agent: AgentCapabilities): Promise<boolean>;
  getCapabilities(): TransportCapabilities;
}

export interface TransportCapabilities {
  supportsStreaming: boolean;
  supportsCompression: boolean;
  maxPayloadSizeBytes: number;
  protocols: string[];
}

export interface HandoffRequest {
  payload: HandoffPayload;
  targetAgent: AgentCapabilities;
  sourceAgent?: AgentCapabilities;
  timeout?: number;
  requireExplicitAcceptance?: boolean;
}

export interface HandoffResponse {
  accepted: boolean;
  responseCode: number;
  message?: string;
  receivingAgent?: AgentCapabilities;
  timestamp: Date;
  customData?: Record<string, unknown>;
}
