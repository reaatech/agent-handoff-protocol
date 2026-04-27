export type HandoffTrigger =
  | ConfidenceTooLow
  | TopicBoundaryCrossed
  | EscalationRequested
  | SpecialistRequired
  | LoadBalancing;

export interface ConfidenceTooLow {
  type: 'confidence_too_low';
  currentConfidence: number;
  threshold: number;
  message: string;
}

export interface TopicBoundaryCrossed {
  type: 'topic_boundary_crossed';
  fromTopic: string;
  toTopic: string;
  confidence: number;
}

export interface EscalationRequested {
  type: 'escalation_requested';
  reason: string;
  requestedBy: 'user' | 'agent' | 'system';
}

export interface SpecialistRequired {
  type: 'specialist_required';
  requiredSkills: string[];
  currentAgentSkills: string[];
}

export interface LoadBalancing {
  type: 'load_balancing';
  currentLoad: number;
  threshold: number;
  targetAgent?: string;
}
