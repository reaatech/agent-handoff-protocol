import { z } from 'zod';
import type { HandoffPayload, AgentCapabilities } from '../types/index.js';
import type { ValidationResult } from './schemas.js';

const handoffPayloadSchema = z.object({
  handoffId: z.string().min(1).max(128),
  sessionId: z.string().min(1),
  conversationId: z.string().min(1),
  sessionHistory: z.array(
    z.object({
      id: z.string(),
      role: z.enum(['user', 'assistant', 'system', 'tool']),
      content: z.string(),
      timestamp: z.date(),
      metadata: z.record(z.unknown()).optional(),
    })
  ),
  compressedContext: z.object({
    summary: z.string(),
    keyFacts: z.array(
      z.object({
        fact: z.string(),
        importance: z.number().min(0).max(1),
        sourceMessageIds: z.array(z.string()),
      })
    ),
    intents: z.array(
      z.object({
        intent: z.string(),
        confidence: z.number().min(0).max(1),
        entities: z.array(z.string()),
      })
    ),
    entities: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        value: z.unknown(),
        resolved: z.boolean(),
      })
    ),
    openItems: z.array(
      z.object({
        description: z.string(),
        priority: z.enum(['low', 'medium', 'high']),
        dueTimestamp: z.date().optional(),
      })
    ),
    compressionMethod: z.string(),
    originalTokenCount: z.number().min(0),
    compressedTokenCount: z.number().min(0),
    compressionRatio: z.number().min(0),
  }),
  handoffReason: z.record(z.unknown()),
  userMetadata: z.object({
    userId: z.string(),
    preferences: z.record(z.unknown()).optional(),
    language: z.string().optional(),
    timezone: z.string().optional(),
  }),
  conversationState: z.object({
    currentIntent: z.string().optional(),
    resolvedEntities: z.record(z.unknown()),
    openQuestions: z.array(z.string()),
    contextVariables: z.record(z.unknown()),
  }),
  createdAt: z.date(),
  expiresAt: z.date().optional(),
  customData: z.record(z.unknown()).optional(),
});

const agentCapabilitiesSchema = z.object({
  agentId: z.string().min(1),
  agentName: z.string().min(1),
  skills: z.array(z.string()),
  domains: z.array(z.string()),
  maxConcurrentSessions: z.number().int().min(1),
  currentLoad: z.number().int().min(0),
  languages: z.array(z.string()),
  specializations: z.array(
    z.object({
      domain: z.string(),
      proficiencyLevel: z.number().min(0).max(1),
      minConfidenceThreshold: z.number().min(0).max(1),
    })
  ),
  availability: z.enum(['available', 'busy', 'away', 'offline']),
  version: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export function createZodValidator(): (
  payload: HandoffPayload,
  targetAgent: AgentCapabilities
) => ValidationResult {
  return (payload, targetAgent) => {
    const payloadResult = handoffPayloadSchema.safeParse(payload);
    const agentResult = agentCapabilitiesSchema.safeParse(targetAgent);

    const errors: string[] = [];

    if (!payloadResult.success) {
      errors.push(...payloadResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`));
    }

    if (!agentResult.success) {
      errors.push(...agentResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`));
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };
}
