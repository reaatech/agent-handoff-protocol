import type { ConversationState, Message, UserMetadata } from './messages.js';
import type { HandoffTrigger } from './triggers.js';

export interface HandoffPayload {
  handoffId: string;
  sessionId: string;
  conversationId: string;
  sessionHistory: Message[];
  compressedContext: CompressedContext;
  handoffReason: HandoffTrigger;
  userMetadata: UserMetadata;
  conversationState: ConversationState;
  createdAt: Date;
  expiresAt?: Date;
  customData?: Record<string, unknown>;
}

export interface CompressedContext {
  summary: string;
  keyFacts: KeyFact[];
  intents: Intent[];
  entities: Entity[];
  openItems: OpenItem[];
  compressionMethod: string;
  originalTokenCount: number;
  compressedTokenCount: number;
  compressionRatio: number;
}

export interface KeyFact {
  fact: string;
  importance: number;
  sourceMessageIds: string[];
}

export interface Intent {
  intent: string;
  confidence: number;
  entities: string[];
}

export interface Entity {
  name: string;
  type: string;
  value: unknown;
  resolved: boolean;
}

export interface OpenItem {
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueTimestamp?: Date;
}
