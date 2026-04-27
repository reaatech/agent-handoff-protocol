export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  /** ISO 8601 string. The library accepts Date objects and serializes them to strings before transport. */
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface UserMetadata {
  userId: string;
  preferences?: Record<string, unknown>;
  language?: string;
  timezone?: string;
}

export interface ConversationState {
  currentIntent?: string;
  resolvedEntities: Record<string, unknown>;
  openQuestions: string[];
  contextVariables: Record<string, unknown>;
}
