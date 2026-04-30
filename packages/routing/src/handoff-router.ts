import type {
  AgentCapabilities,
  HandoffConfig,
  HandoffPayload,
  HandoffRouter,
  RoutingDecision,
} from '@reaatech/agent-handoff';

export interface RoutingConfig {
  minConfidenceThreshold: number;
  ambiguityThreshold: number;
  maxAlternatives: number;
  policy: 'strict' | 'best_effort' | 'hierarchical';
}

/**
 * Routes handoffs to the best-matching agent based on capability scoring.
 *
 * Scoring weights:
 * - Skill match: 40%
 * - Domain match: 30%
 * - Load factor: 20%
 * - Language match: 10%
 *
 * Returns a `PrimaryRoute`, `ClarificationRoute`, or `FallbackRoute`
 * depending on confidence and ambiguity.
 */
export class CapabilityBasedRouter implements HandoffRouter {
  constructor(private readonly config: RoutingConfig) {}

  /**
   * Create a router from a full HandoffConfig object.
   */
  static fromConfig(config: HandoffConfig): CapabilityBasedRouter {
    return new CapabilityBasedRouter(config.routing);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async route(
    payload: HandoffPayload,
    availableAgents: AgentCapabilities[],
  ): Promise<RoutingDecision> {
    const compatibleAgents = this.filterByCompatibility(payload, availableAgents);

    if (compatibleAgents.length === 0) {
      return this.handleNoMatch();
    }

    const scoredAgents = compatibleAgents.map((agent) => ({
      agent,
      score: this.calculateAgentScore(payload, agent),
    }));

    scoredAgents.sort((a, b) => b.score - a.score);

    const best = scoredAgents[0];
    const second = scoredAgents[1];

    if (best.score < this.config.minConfidenceThreshold) {
      return this.handleLowConfidence(scoredAgents);
    }

    if (second && this.isAmbiguous(best.score, second.score)) {
      return this.handleAmbiguity([best, second]);
    }

    return {
      type: 'primary',
      targetAgent: best.agent,
      confidence: best.score,
      alternatives: scoredAgents.slice(1, this.config.maxAlternatives + 1).map((s) => s.agent),
    };
  }

  private filterByCompatibility(
    payload: HandoffPayload,
    agents: AgentCapabilities[],
  ): AgentCapabilities[] {
    return agents.filter((a) => {
      // Must not be offline
      if (a.availability === 'offline') return false;

      // Must have capacity
      if (a.currentLoad >= a.maxConcurrentSessions) return false;

      // If expiry is set, must be available
      if (payload.expiresAt && a.availability === 'away') return false;

      return true;
    });
  }

  private calculateAgentScore(payload: HandoffPayload, agent: AgentCapabilities): number {
    const skillMatch = this.calculateSkillMatch(payload, agent);
    const domainMatch = this.calculateDomainMatch(payload, agent);
    const loadFactor = this.calculateLoadFactor(agent);
    const languageMatch = this.calculateLanguageMatch(payload, agent);

    return skillMatch * 0.4 + domainMatch * 0.3 + loadFactor * 0.2 + languageMatch * 0.1;
  }

  private calculateSkillMatch(payload: HandoffPayload, agent: AgentCapabilities): number {
    const trigger = payload.handoffReason;
    let requiredSkills: string[] = [];

    switch (trigger.type) {
      case 'specialist_required':
        requiredSkills = trigger.requiredSkills;
        break;
      case 'topic_boundary_crossed':
        // Infer skills from topic
        requiredSkills = [trigger.toTopic.toLowerCase()];
        break;
      case 'escalation_requested':
        requiredSkills = ['escalation', 'supervisor'];
        break;
      case 'confidence_too_low':
        // Use conversation state intent if available
        requiredSkills = payload.conversationState.currentIntent
          ? [payload.conversationState.currentIntent]
          : [];
        break;
      case 'load_balancing':
        // Load balancing doesn't require specific skills
        return 0.5;
    }

    if (requiredSkills.length === 0) return 0.5;

    const required = new Set(requiredSkills.map((s) => s.toLowerCase()));
    const matched = agent.skills.filter((s) => required.has(s.toLowerCase())).length;
    return matched / required.size;
  }

  private calculateDomainMatch(payload: HandoffPayload, agent: AgentCapabilities): number {
    const trigger = payload.handoffReason;
    let targetDomains: string[] = [];

    switch (trigger.type) {
      case 'topic_boundary_crossed':
        targetDomains = [trigger.toTopic.toLowerCase()];
        break;
      case 'specialist_required':
        // Map skills to domains heuristically
        targetDomains = trigger.requiredSkills.map((s) => s.toLowerCase());
        break;
      case 'escalation_requested':
        targetDomains = ['escalation', 'support'];
        break;
      default:
        // Use conversation state intent as domain hint
        targetDomains = payload.conversationState.currentIntent
          ? [payload.conversationState.currentIntent]
          : [];
    }

    if (targetDomains.length === 0) return 0.5;
    if (agent.domains.length === 0) return 0.3;

    const agentDomains = new Set(agent.domains.map((d) => d.toLowerCase()));
    const matched = targetDomains.filter((d) => agentDomains.has(d)).length;
    return Math.min(1, matched / targetDomains.length);
  }

  private calculateLoadFactor(agent: AgentCapabilities): number {
    if (agent.maxConcurrentSessions === 0) return 0;
    const ratio = agent.currentLoad / agent.maxConcurrentSessions;
    return Math.max(0, 1 - ratio);
  }

  private calculateLanguageMatch(payload: HandoffPayload, agent: AgentCapabilities): number {
    const userLang = payload.userMetadata.language;
    if (!userLang) return 1;
    return agent.languages.some((l) => l.toLowerCase() === userLang.toLowerCase()) ? 1 : 0;
  }

  private isAmbiguous(bestScore: number, secondScore: number): boolean {
    return bestScore - secondScore < this.config.ambiguityThreshold;
  }

  private handleNoMatch(): RoutingDecision {
    return { type: 'fallback', reason: 'no_match' };
  }

  private handleLowConfidence(
    scoredAgents: { agent: AgentCapabilities; score: number }[],
  ): RoutingDecision {
    const best = scoredAgents[0];
    if (this.config.policy === 'best_effort' && best) {
      return {
        type: 'primary',
        targetAgent: best.agent,
        confidence: best.score,
        alternatives: scoredAgents.slice(1, this.config.maxAlternatives + 1).map((s) => s.agent),
      };
    }
    return { type: 'fallback', reason: 'low_confidence' };
  }

  private handleAmbiguity(
    topAgents: { agent: AgentCapabilities; score: number }[],
  ): RoutingDecision {
    const candidates = topAgents.map((t) => t.agent);
    const questions = this.generateClarificationQuestions(candidates);

    return {
      type: 'clarification',
      candidateAgents: candidates,
      clarificationQuestions: questions,
      recommendedAction: 'ask_user',
    };
  }

  private generateClarificationQuestions(agents: AgentCapabilities[]): string[] {
    if (agents.length < 2) return ['Which specialist would you prefer?'];

    const a = agents[0];
    const b = agents[1];

    const questions: string[] = [];

    // Compare domains
    const aDomains = new Set(a.domains);
    const bDomains = new Set(b.domains);
    const uniqueADomains = a.domains.filter((d) => !bDomains.has(d));
    const uniqueBDomains = b.domains.filter((d) => !aDomains.has(d));

    if (uniqueADomains.length > 0 || uniqueBDomains.length > 0) {
      questions.push(
        `Would you prefer help with ${uniqueADomains.join(', ') || a.domains.join(', ')} or ${uniqueBDomains.join(', ') || b.domains.join(', ')}?`,
      );
    }

    // Compare skills
    const aSkills = new Set(a.skills);
    const uniqueBSkills = b.skills.filter((s) => !aSkills.has(s));
    if (uniqueBSkills.length > 0) {
      questions.push(`Do you need expertise in ${uniqueBSkills.slice(0, 3).join(', ')}?`);
    }

    if (questions.length === 0) {
      questions.push('Which specialist would you prefer?');
    }

    return questions;
  }
}
