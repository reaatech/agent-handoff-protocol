import type { HandoffPayload, AgentCapabilities } from '../types/index.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export type RejectionReason =
  | 'capability_mismatch'
  | 'overloaded'
  | 'invalid_payload'
  | 'timeout'
  | 'unavailable'
  | 'unknown';

// Manual validation fallback (works without zod)
export function validatePayloadManual(
  payload: HandoffPayload,
  targetAgent: AgentCapabilities
): ValidationResult {
  const errors: string[] = [];

  if (
    !payload.handoffId ||
    typeof payload.handoffId !== 'string' ||
    payload.handoffId.length > 128
  ) {
    errors.push('handoffId must be a non-empty string <= 128 characters');
  }

  if (!payload.sessionId || typeof payload.sessionId !== 'string') {
    errors.push('sessionId is required');
  }

  if (!payload.conversationId || typeof payload.conversationId !== 'string') {
    errors.push('conversationId is required');
  }

  if (!Array.isArray(payload.sessionHistory)) {
    errors.push('sessionHistory must be an array');
  } else {
    for (let i = 0; i < payload.sessionHistory.length; i++) {
      const msg = payload.sessionHistory[i];
      if (!msg || typeof msg !== 'object') {
        errors.push(`sessionHistory[${String(i)}] must be an object`);
        continue;
      }
      if (!msg.id || typeof msg.id !== 'string') {
        errors.push(`sessionHistory[${String(i)}].id is required`);
      }
      if (!['user', 'assistant', 'system', 'tool'].includes(msg.role)) {
        errors.push(
          `sessionHistory[${String(i)}].role must be one of: user, assistant, system, tool`
        );
      }
      if (typeof msg.content !== 'string') {
        errors.push(`sessionHistory[${String(i)}].content must be a string`);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!payload.compressedContext || typeof payload.compressedContext !== 'object') {
    errors.push('compressedContext is required');
  } else {
    if (typeof payload.compressedContext.summary !== 'string') {
      errors.push('compressedContext.summary must be a string');
    }
    if (typeof payload.compressedContext.compressionMethod !== 'string') {
      errors.push('compressedContext.compressionMethod must be a string');
    }
    if (
      typeof payload.compressedContext.originalTokenCount !== 'number' ||
      payload.compressedContext.originalTokenCount < 0
    ) {
      errors.push('compressedContext.originalTokenCount must be a non-negative number');
    }
    if (
      typeof payload.compressedContext.compressedTokenCount !== 'number' ||
      payload.compressedContext.compressedTokenCount < 0
    ) {
      errors.push('compressedContext.compressedTokenCount must be a non-negative number');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!payload.userMetadata || typeof payload.userMetadata !== 'object') {
    errors.push('userMetadata is required');
  } else if (!payload.userMetadata.userId || typeof payload.userMetadata.userId !== 'string') {
    errors.push('userMetadata.userId is required');
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!payload.conversationState || typeof payload.conversationState !== 'object') {
    errors.push('conversationState is required');
  }

  // Validate compatibility with target agent
  const compatErrors = validateCompatibilityManual(payload, targetAgent);
  errors.push(...compatErrors);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateAgentCapabilitiesManual(agent: AgentCapabilities): ValidationResult {
  const errors: string[] = [];

  if (!agent.agentId || typeof agent.agentId !== 'string') {
    errors.push('agentId is required');
  }

  if (!agent.agentName || typeof agent.agentName !== 'string') {
    errors.push('agentName is required');
  }

  if (!Array.isArray(agent.skills)) {
    errors.push('skills must be an array');
  }

  if (!Array.isArray(agent.domains)) {
    errors.push('domains must be an array');
  }

  if (typeof agent.maxConcurrentSessions !== 'number' || agent.maxConcurrentSessions < 1) {
    errors.push('maxConcurrentSessions must be a positive number');
  }

  if (typeof agent.currentLoad !== 'number' || agent.currentLoad < 0) {
    errors.push('currentLoad must be a non-negative number');
  }

  if (agent.currentLoad > agent.maxConcurrentSessions) {
    errors.push('currentLoad cannot exceed maxConcurrentSessions');
  }

  if (!Array.isArray(agent.languages)) {
    errors.push('languages must be an array');
  }

  if (!Array.isArray(agent.specializations)) {
    errors.push('specializations must be an array');
  }

  const validAvailability = ['available', 'busy', 'away', 'offline'];
  if (!validAvailability.includes(agent.availability)) {
    errors.push(`availability must be one of: ${validAvailability.join(', ')}`);
  }

  if (typeof agent.version !== 'string') {
    errors.push('version must be a string');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateCompatibilityManual(
  payload: HandoffPayload,
  targetAgent: AgentCapabilities
): string[] {
  const errors: string[] = [];

  // Check language compatibility
  const userLang = payload.userMetadata?.language;
  if (userLang && !targetAgent.languages.some((l) => l.toLowerCase() === userLang.toLowerCase())) {
    errors.push(`Agent does not support language: ${userLang}`);
  }

  // Check if agent is overloaded
  if (targetAgent.currentLoad >= targetAgent.maxConcurrentSessions) {
    errors.push('Agent is at maximum capacity');
  }

  // Check if agent is available
  if (targetAgent.availability === 'offline' || targetAgent.availability === 'away') {
    errors.push(`Agent is ${targetAgent.availability}`);
  }

  // Check payload size against agent's typical capacity
  const historySize = payload.sessionHistory.length;
  if (historySize > 10000) {
    errors.push('Session history exceeds maximum size');
  }

  return errors;
}

export function classifyRejectionReason(errorMessage: string): RejectionReason {
  const lower = errorMessage.toLowerCase();
  if (lower.includes('capability') || lower.includes('skill') || lower.includes('domain')) {
    return 'capability_mismatch';
  }
  if (
    lower.includes('load') ||
    lower.includes('capacity') ||
    lower.includes('busy') ||
    lower.includes('overload')
  ) {
    return 'overloaded';
  }
  if (lower.includes('invalid') || lower.includes('validation') || lower.includes('schema')) {
    return 'invalid_payload';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'timeout';
  }
  if (lower.includes('unavailable') || lower.includes('offline') || lower.includes('away')) {
    return 'unavailable';
  }
  return 'unknown';
}
