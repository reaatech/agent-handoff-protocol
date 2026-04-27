import type { HandoffConfig, DeepPartial } from '../types/index.js';

export const defaultHandoffConfig: HandoffConfig = {
  compression: {
    maxTokens: 2000,
    strategy: 'hybrid',
    preserveRecentMessages: 3,
  },

  routing: {
    minConfidenceThreshold: 0.7,
    ambiguityThreshold: 0.15,
    maxAlternatives: 3,
    policy: 'best_effort',
  },

  transport: {
    preferred: 'auto',
    timeout: 30000,
    retries: 3,
    requireExplicitAcceptance: true,
  },

  triggers: {
    confidenceThreshold: 0.6,
    topicChangeThreshold: 0.8,
    escalationKeywords: ['speak to manager', 'human agent', 'escalate'],
  },
};

export function createHandoffConfig(options?: DeepPartial<HandoffConfig>): HandoffConfig {
  return {
    compression: {
      maxTokens: options?.compression?.maxTokens ?? defaultHandoffConfig.compression.maxTokens,
      strategy: options?.compression?.strategy ?? defaultHandoffConfig.compression.strategy,
      preserveRecentMessages:
        options?.compression?.preserveRecentMessages ??
        defaultHandoffConfig.compression.preserveRecentMessages,
    },
    routing: {
      minConfidenceThreshold:
        options?.routing?.minConfidenceThreshold ??
        defaultHandoffConfig.routing.minConfidenceThreshold,
      ambiguityThreshold:
        options?.routing?.ambiguityThreshold ?? defaultHandoffConfig.routing.ambiguityThreshold,
      maxAlternatives:
        options?.routing?.maxAlternatives ?? defaultHandoffConfig.routing.maxAlternatives,
      policy: options?.routing?.policy ?? defaultHandoffConfig.routing.policy,
    },
    transport: {
      preferred: options?.transport?.preferred ?? defaultHandoffConfig.transport.preferred,
      timeout: options?.transport?.timeout ?? defaultHandoffConfig.transport.timeout,
      retries: options?.transport?.retries ?? defaultHandoffConfig.transport.retries,
      requireExplicitAcceptance:
        options?.transport?.requireExplicitAcceptance ??
        defaultHandoffConfig.transport.requireExplicitAcceptance,
    },
    triggers: {
      confidenceThreshold:
        options?.triggers?.confidenceThreshold ?? defaultHandoffConfig.triggers.confidenceThreshold,
      topicChangeThreshold:
        options?.triggers?.topicChangeThreshold ??
        defaultHandoffConfig.triggers.topicChangeThreshold,
      escalationKeywords:
        options?.triggers?.escalationKeywords ?? defaultHandoffConfig.triggers.escalationKeywords,
    },
  };
}
