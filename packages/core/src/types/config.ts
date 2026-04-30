import type { HandoffError } from '../utils/errors.js';
import type { ConversationState, Message, UserMetadata } from './messages.js';
import type { CompressedContext, HandoffPayload } from './payload.js';
import type { AgentCapabilities, RoutingDecision } from './routing.js';
import type { HandoffTrigger } from './triggers.js';

export interface HandoffConfig {
  compression: {
    maxTokens: number;
    strategy: 'summary' | 'sliding_window' | 'hybrid';
    preserveRecentMessages: number;
  };

  routing: {
    minConfidenceThreshold: number;
    ambiguityThreshold: number;
    maxAlternatives: number;
    policy: 'strict' | 'best_effort' | 'hierarchical';
  };

  transport: {
    preferred: 'mcp' | 'a2a' | 'auto';
    timeout: number;
    retries: number;
    requireExplicitAcceptance: boolean;
  };

  triggers: {
    confidenceThreshold: number;
    topicChangeThreshold: number;
    escalationKeywords: string[];
  };
}

export interface CompressionOptions {
  maxTokens: number;
  strategy?: 'summary' | 'sliding_window' | 'hybrid';
  preserveRecentMessages?: number;
  maskPII?: MaskPIICallback;
}

export type MaskPIICallback = (text: string) => string;

export interface ContextCompressor {
  compress(messages: Message[], options?: CompressionOptions): Promise<CompressedContext>;
  estimateTokens(text: string): number;
}

export interface HandoffRouter {
  route(payload: HandoffPayload, availableAgents: AgentCapabilities[]): Promise<RoutingDecision>;
}

export interface HandoffContext {
  sessionId: string;
  conversationId: string;
  messages: Message[];
  trigger: HandoffTrigger;
  userMetadata: UserMetadata;
  state: ConversationState;
  availableAgents: AgentCapabilities[];
}

export interface HandoffOptions {
  sourceAgent?: AgentCapabilities;
  compressionOptions?: CompressionOptions;
  preferredTransport?: 'mcp' | 'a2a' | 'auto';
  timeout?: number;
  requireExplicitAcceptance?: boolean;
  expiresAt?: Date;
}

export interface HandoffResult {
  success: boolean;
  handoffId: string;
  receivingAgent?: AgentCapabilities;
  routingDecision: RoutingDecision;
  timestamp: Date;
  error?: HandoffError;
  rejectionReason?: string;
}
