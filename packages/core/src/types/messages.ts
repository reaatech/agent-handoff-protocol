export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
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
