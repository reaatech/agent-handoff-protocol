export type RoutingDecision = PrimaryRoute | ClarificationRoute | FallbackRoute;

export interface PrimaryRoute {
  type: 'primary';
  targetAgent: AgentCapabilities;
  confidence: number;
  alternatives: AgentCapabilities[];
}

export interface ClarificationRoute {
  type: 'clarification';
  candidateAgents: AgentCapabilities[];
  clarificationQuestions: string[];
  recommendedAction: 'ask_user' | 'escalate';
}

export interface FallbackRoute {
  type: 'fallback';
  fallbackAgent?: AgentCapabilities;
  reason: 'no_match' | 'low_confidence' | 'all_busy' | 'all_rejected' | 'unexpected_error';
  queueForLater?: boolean;
}

export interface AgentCapabilities {
  agentId: string;
  agentName: string;
  skills: string[];
  domains: string[];
  maxConcurrentSessions: number;
  currentLoad: number;
  languages: string[];
  specializations: Specialization[];
  availability: AvailabilityStatus;
  version: string;
  metadata?: Record<string, unknown>;
  /** Optional: `metadata.endpoint` is used by A2ATransport to determine the agent's HTTP URL */
}

export interface Specialization {
  domain: string;
  proficiencyLevel: number; // 0-1
  minConfidenceThreshold: number;
}

export type AvailabilityStatus = 'available' | 'busy' | 'away' | 'offline';
