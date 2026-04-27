# Agent Handoff Protocol — Architecture Specification

## System Overview

The Agent Handoff Protocol is a small, opinionated TypeScript library that orchestrates the transfer of conversations between agents. The architecture prioritizes:

1. **Zero runtime dependencies** — everything is built-in or user-injected
2. **Transport agnosticism** — MCP and A2A supported out of the box
3. **Type safety** — strict TypeScript with no `any` in the public API
4. **Composability** — interfaces for compression, routing, and transport allow customization without forking

The library is organized into four layers, but unlike a platform, each layer is a thin module exported from the package. Users import what they need and compose a `HandoffManager`.

---

## Package & Module Structure

```
src/
├── index.ts                 # Public API: HandoffManager, createHandoffConfig, types
├── types/                   # All domain types (tree-shakeable re-exports)
├── core/                    # HandoffManager, HandoffExecutor, config
├── compression/             # Compressor implementations
├── routing/                 # Router + AgentRegistry
├── transport/               # MCP, A2A, TransportFactory
├── validation/              # Payload validation
└── utils/                   # Errors, retry, event emitter
```

**Design principle**: Every subdirectory is independently importable for advanced users, but most users only need `import { HandoffManager, createHandoffConfig } from 'agent-handoff-protocol'`.

---

## Public API Surface

### `HandoffManager`

The primary entry point. Users instantiate this with a configuration and call `executeHandoff()`.

```typescript
export class HandoffManager {
  readonly config: HandoffConfig;

  constructor(
    config: HandoffConfig,
    deps?: {
      router?: HandoffRouter;
      compressor?: ContextCompressor;
      transportFactory?: TransportFactory;
    }
  );

  /**
   * Execute a handoff from the current agent to the best available target.
   * Pre-registered agents are automatically merged with context.availableAgents.
   */
  executeHandoff(context: HandoffContext, options?: HandoffOptions): Promise<HandoffResult>;

  /**
   * Subscribe to handoff lifecycle events for observability.
   */
  on<E extends keyof HandoffEventMap>(
    event: E,
    handler: (payload: HandoffEventMap[E]) => void
  ): void;
  off<E extends keyof HandoffEventMap>(
    event: E,
    handler: (payload: HandoffEventMap[E]) => void
  ): void;

  /**
   * Register an agent's capabilities in the local registry.
   */
  registerAgent(capabilities: AgentCapabilities): void;

  /**
   * Remove an agent from the local registry.
   */
  unregisterAgent(agentId: string): void;

  /**
   * Get all currently registered agents.
   */
  getRegisteredAgents(): AgentCapabilities[];
}
```

### `createHandoffConfig`

Factory function that merges user options with sensible defaults and validates the result.

```typescript
export function createHandoffConfig(options?: DeepPartial<HandoffConfig>): HandoffConfig;
```

### Key Exports

```typescript
// Main API
export { HandoffManager, createHandoffConfig } from './core';

// Types (all interfaces and unions)
export type {
  HandoffTrigger,
  HandoffPayload,
  HandoffRequest,
  HandoffResponse,
  HandoffResult,
  HandoffContext,
  HandoffOptions,
  HandoffConfig,
  RoutingDecision,
  AgentCapabilities,
  ContextCompressor,
  TransportLayer,
  // ... all other public types
} from './types';

// Implementations (for advanced composition)
export { HybridCompressor, SummaryCompressor, SlidingWindowCompressor } from './compression';
export { CapabilityBasedRouter, AgentRegistry } from './routing';
export { MCPTransport, A2ATransport, TransportFactory } from './transport';
export { HandoffValidator } from './validation';
```

---

## High-Level Architecture

```
┌─────────────────────────────────────────┐
│           Public API Layer               │
│         HandoffManager                   │
│  (events · config · executeHandoff)     │
└─────────────────────────────────────────┘
                   │
┌──────────────────┼──────────────────────┐
│           Core Services Layer            │
│  ┌───────────────┴───────────────┐      │
│  │      HandoffExecutor          │      │
│  │  compress → route → validate  │      │
│  │   → transport → handle reply  │      │
│  └───────────────────────────────┘      │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │HandoffRouter│  │ContextCompressor│   │
│  └─────────────┘  └─────────────────┘   │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │AgentRegistry│  │HandoffValidator │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────┘
                   │
┌──────────────────┼──────────────────────┐
│           Transport Layer                │
│  ┌─────────────┐      ┌─────────────┐   │
│  │ MCPTransport│      │ A2ATransport│   │
│  └─────────────┘      └─────────────┘   │
│  ┌─────────────────────────────────┐    │
│  │        TransportFactory          │    │
│  │  (selection · health · fallback) │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## Core Types

### Utility Types

```typescript
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
```

### Messages & Conversation State

```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  /** ISO 8601 string. The library accepts Date objects and serializes them to strings before transport. */
  timestamp: Date;
  metadata?: Record<string, unknown>;
  /** Optional: `metadata.endpoint` is used by A2ATransport to determine the agent's HTTP URL */
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
```

### Handoff Triggers

```typescript
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
```

### Handoff Payload

```typescript
export interface HandoffPayload {
  handoffId: string;
  sessionId: string;
  conversationId: string;
  sessionHistory: Message[];
  compressedContext: CompressedContext;
  handoffReason: HandoffTrigger;
  userMetadata: UserMetadata;
  conversationState: ConversationState;
  /** ISO 8601 string after serialization; typed as Date for developer ergonomics */
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
  importance: number; // 0-1
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
```

### Agent Capabilities

```typescript
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
}

export interface Specialization {
  domain: string;
  proficiencyLevel: number; // 0-1
  minConfidenceThreshold: number;
}

export type AvailabilityStatus = 'available' | 'busy' | 'away' | 'offline';
```

### Handoff Request / Response

```typescript
export interface HandoffRequest {
  payload: HandoffPayload;
  targetAgent: AgentCapabilities;
  sourceAgent?: AgentCapabilities;
  timeout?: number;
  requireExplicitAcceptance?: boolean;
}

export interface HandoffResponse {
  accepted: boolean;
  responseCode: number;
  message?: string;
  receivingAgent?: AgentCapabilities;
  timestamp: Date;
  customData?: Record<string, unknown>;
}
```

### Execution Context & Result

```typescript
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
```

### Compression Options

```typescript
export interface CompressionOptions {
  maxTokens: number;
  strategy: 'summary' | 'sliding_window' | 'hybrid';
  preserveRecentMessages?: number; // always include last N messages verbatim
}

export interface ContextCompressor {
  compress(messages: Message[], options?: CompressionOptions): Promise<CompressedContext>;
  estimateTokens(text: string): number;
}
```

---

## Context Compression Engine

The compression engine reduces conversation history to essential information while preserving context needed for effective handoff.

```typescript
export interface ContextCompressor {
  compress(messages: Message[], options?: CompressionOptions): Promise<CompressedContext>;

  estimateTokens(text: string): number;
}

export interface TokenCounter {
  estimate(text: string): number;
}

export interface CompressionStrategy {
  name: string;
  compress(messages: Message[], options?: CompressionOptions): Promise<Partial<CompressedContext>>;
}

export class HybridCompressor implements ContextCompressor {
  private tokenCounter: TokenCounter;

  async compress(messages: Message[], options?: CompressionOptions): Promise<CompressedContext> {
    // 1. Preserve recent messages verbatim (configurable)
    const recentMessages = options?.preserveRecentMessages
      ? messages.slice(-options.preserveRecentMessages)
      : [];
    const historicalMessages = messages.slice(0, -recentMessages.length);

    // 2. Apply sliding window for remaining historical messages
    const windowedMessages = this.applySlidingWindow(historicalMessages, options);

    // 3. Extract key facts and entities
    const keyFacts = this.extractKeyFacts(historicalMessages);
    const entities = this.extractEntities(historicalMessages);

    // 4. Generate summary
    const summary = await this.generateSummary(windowedMessages, options);

    // 5. Identify intents and open items
    const intents = this.identifyIntents(historicalMessages);
    const openItems = this.identifyOpenItems(historicalMessages);

    const allContent = [
      ...recentMessages.map((m) => m.content),
      summary,
      ...keyFacts.map((f) => f.fact),
      ...entities.map((e) => `${e.name}: ${e.value}`),
    ].join('\n');

    const originalTokenCount = this.estimateTokens(messages.map((m) => m.content).join('\n'));
    const compressedTokenCount = this.estimateTokens(allContent);
    const compressionRatio = originalTokenCount > 0 ? compressedTokenCount / originalTokenCount : 0;

    return {
      summary,
      keyFacts,
      entities,
      intents,
      openItems,
      compressionMethod: 'hybrid',
      originalTokenCount,
      compressedTokenCount,
      compressionRatio,
    };
  }

  estimateTokens(text: string): number {
    return this.tokenCounter.estimate(text);
  }
}
```

#### Compression Strategies

1. **SummaryCompressor**: Extractive summarization (sentence scoring) with optional LLM hook
2. **SlidingWindowCompressor**: Recent N messages within a token budget
3. **HybridCompressor**: Combines sliding window for recency + summary for older context

---

## Handoff Router

Implements the route/clarify/fallback tree pattern from AskGM.

```typescript
export interface HandoffRouter {
  route(payload: HandoffPayload, availableAgents: AgentCapabilities[]): Promise<RoutingDecision>;
}

export class CapabilityBasedRouter implements HandoffRouter {
  constructor(private config: RoutingConfig) {}

  async route(
    payload: HandoffPayload,
    availableAgents: AgentCapabilities[]
  ): Promise<RoutingDecision> {
    // 1. Filter to compatible agents
    const compatibleAgents = this.filterByCompatibility(payload, availableAgents);

    if (compatibleAgents.length === 0) {
      return this.handleNoMatch(payload);
    }

    // 2. Score agents
    const scoredAgents = compatibleAgents.map((agent) => ({
      agent,
      score: this.calculateAgentScore(payload, agent),
    }));

    scoredAgents.sort((a, b) => b.score - a.score);

    const best = scoredAgents[0];
    const second = scoredAgents[1];

    // 3. Check confidence threshold
    if (best.score < this.config.minConfidenceThreshold) {
      return this.handleLowConfidence(payload, scoredAgents);
    }

    // 4. Check ambiguity
    if (second && this.isAmbiguous(best.score, second.score)) {
      return this.handleAmbiguity(payload, [best, second]);
    }

    return {
      type: 'primary',
      targetAgent: best.agent,
      confidence: best.score,
      alternatives: scoredAgents.slice(1, 3).map((s) => s.agent),
    };
  }

  private calculateAgentScore(payload: HandoffPayload, agent: AgentCapabilities): number {
    const skillMatch = this.calculateSkillMatch(payload, agent);
    const domainMatch = this.calculateDomainMatch(payload, agent);
    const loadFactor = this.calculateLoadFactor(agent);
    const languageMatch = this.calculateLanguageMatch(payload, agent);

    return skillMatch * 0.4 + domainMatch * 0.3 + loadFactor * 0.2 + languageMatch * 0.1;
  }

  private isAmbiguous(bestScore: number, secondScore: number): boolean {
    return bestScore - secondScore < this.config.ambiguityThreshold;
  }
}
```

#### Routing Decision Tree

```typescript
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
  reason: 'no_match' | 'low_confidence' | 'all_busy' | 'all_rejected';
  queueForLater?: boolean;
}
```

---

## Transport Layers

### Transport Interface

```typescript
export interface TransportLayer {
  readonly name: string;
  readonly priority: number;

  sendHandoff(request: HandoffRequest): Promise<HandoffResponse>;
  validateConnection(agent: AgentCapabilities): Promise<boolean>;
  getCapabilities(): TransportCapabilities;
}

export interface TransportCapabilities {
  supportsStreaming: boolean;
  supportsCompression: boolean;
  maxPayloadSizeBytes: number;
  protocols: string[];
}
```

### MCP Transport

```typescript
export interface MCPClient {
  callTool(params: {
    serverId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  }): Promise<unknown>;
  ping(serverId: string): Promise<void>;
}

export class MCPTransport implements TransportLayer {
  readonly name = 'mcp';
  readonly priority = 1;

  constructor(private mcpClient: MCPClient) {}

  async sendHandoff(request: HandoffRequest): Promise<HandoffResponse> {
    const mcpPayload = this.convertToMCPFormat(request.payload);

    const result = await this.mcpClient.callTool({
      serverId: request.targetAgent.agentId,
      toolName: 'accept_handoff',
      arguments: mcpPayload,
    });

    return this.parseMCPResponse(result);
  }

  private convertToMCPFormat(payload: HandoffPayload): Record<string, unknown> {
    return {
      handoff_id: payload.handoffId,
      session_id: payload.sessionId,
      compressed_context: payload.compressedContext,
      handoff_reason: payload.handoffReason,
      user_metadata: payload.userMetadata,
      conversation_state: payload.conversationState,
      custom_data: payload.customData,
    };
  }

  async validateConnection(agent: AgentCapabilities): Promise<boolean> {
    try {
      await this.mcpClient.ping(agent.agentId);
      return true;
    } catch {
      return false;
    }
  }

  getCapabilities(): TransportCapabilities {
    return {
      supportsStreaming: false,
      supportsCompression: true,
      maxPayloadSizeBytes: 10 * 1024 * 1024, // 10MB
      protocols: ['mcp'],
    };
  }
}
```

### A2A Transport

```typescript
export interface HttpClient {
  get<T>(
    url: string,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<{ data: T }>;
  post<T>(
    url: string,
    body: unknown,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<{ data: T }>;
}

export class A2ATransport implements TransportLayer {
  readonly name = 'a2a';
  readonly priority = 2;

  constructor(
    private httpClient: HttpClient,
    private authHeaders?: Record<string, string>
  ) {}

  async sendHandoff(request: HandoffRequest): Promise<HandoffResponse> {
    const endpoint = this.getAgentEndpoint(request.targetAgent);
    const url = `${endpoint}/handoffs`;

    const response = await withRetry(
      () =>
        this.httpClient.post<HandoffResponse>(
          url,
          {
            payload: request.payload,
            sourceAgent: request.sourceAgent,
            requireExplicitAcceptance: request.requireExplicitAcceptance,
            timestamp: new Date().toISOString(),
          },
          {
            headers: this.authHeaders,
            timeout: request.timeout || 30000,
          }
        ),
      {
        maxRetries: 3,
        backoff: 'exponential',
        shouldRetry: (error) => isNetworkError(error) || isServerError(error),
      }
    );

    return response.data;
  }

  async validateConnection(agent: AgentCapabilities): Promise<boolean> {
    const endpoint = this.getAgentEndpoint(agent);
    try {
      await this.httpClient.get(`${endpoint}/health`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  getCapabilities(): TransportCapabilities {
    return {
      supportsStreaming: false,
      supportsCompression: true,
      maxPayloadSizeBytes: 50 * 1024 * 1024, // 50MB
      protocols: ['https', 'http'],
    };
  }

  private getAgentEndpoint(agent: AgentCapabilities): string {
    const endpoint = agent.metadata?.endpoint;
    if (typeof endpoint !== 'string' || !endpoint) {
      throw new TransportError(`Agent ${agent.agentId} has no A2A endpoint configured`, {
        agentId: agent.agentId,
      });
    }
    return endpoint;
  }
}
```

**Note**: A2A v1 uses HTTP request/response with retry. WebSocket support is a post-v1 consideration.

---

## Handoff Executor

Orchestrates the complete handoff process.

```typescript
export class HandoffExecutor {
  constructor(
    private router: HandoffRouter,
    private compressor: ContextCompressor,
    private validator: HandoffValidator,
    private transportFactory: TransportFactory,
    private eventEmitter: TypedEventEmitter<HandoffEventMap>
  ) {}

  async executeHandoff(context: HandoffContext, options?: HandoffOptions): Promise<HandoffResult> {
    const handoffId = this.generateHandoffId();
    const startTime = Date.now();

    this.eventEmitter.emit('handoffStart', {
      handoffId,
      sessionId: context.sessionId,
      trigger: context.trigger,
    });

    try {
      // 1. Compress context
      const compressedContext = await this.compressor.compress(
        context.messages,
        options?.compressionOptions
      );

      // 2. Build payload
      const payload: HandoffPayload = {
        handoffId,
        sessionId: context.sessionId,
        conversationId: context.conversationId,
        sessionHistory: context.messages,
        compressedContext,
        handoffReason: context.trigger,
        userMetadata: context.userMetadata,
        conversationState: context.state,
        createdAt: new Date(),
        expiresAt: options?.expiresAt,
      };

      // 3. Route
      const routingDecision = await this.router.route(payload, context.availableAgents);

      // 4. Execute based on decision type
      const result = await this.executeByDecisionType(handoffId, payload, routingDecision, options);

      const duration = Date.now() - startTime;

      if (result.success) {
        this.eventEmitter.emit('handoffComplete', {
          handoffId,
          duration,
          receivingAgent: result.receivingAgent,
          routingDecision,
        });
      } else {
        this.eventEmitter.emit('handoffReject', {
          handoffId,
          duration,
          reason: result.rejectionReason,
          routingDecision,
        });
      }

      return result;
    } catch (error) {
      const handoffError =
        error instanceof HandoffError
          ? error
          : new HandoffError('Unexpected error during handoff', 'unknown_error', { cause: error });

      this.eventEmitter.emit('handoffError', { handoffId, error: handoffError });

      return {
        success: false,
        handoffId,
        routingDecision: { type: 'fallback', reason: 'no_match' },
        timestamp: new Date(),
        error: handoffError,
      };
    }
  }

  private async executeByDecisionType(
    handoffId: string,
    payload: HandoffPayload,
    decision: RoutingDecision,
    options?: HandoffOptions
  ): Promise<HandoffResult> {
    switch (decision.type) {
      case 'primary':
        return this.executePrimaryRoute(handoffId, payload, decision, options);
      case 'clarification':
        return this.handleClarification(handoffId, payload, decision);
      case 'fallback':
        return this.handleFallback(handoffId, payload, decision);
    }
  }

  private async executePrimaryRoute(
    handoffId: string,
    payload: HandoffPayload,
    decision: PrimaryRoute,
    options?: HandoffOptions
  ): Promise<HandoffResult> {
    const transport = this.transportFactory.getTransport(
      decision.targetAgent,
      options?.preferredTransport
    );

    const validation = await this.validator.validatePayload(payload, decision.targetAgent);
    if (!validation.isValid) {
      return {
        success: false,
        handoffId,
        routingDecision: decision,
        timestamp: new Date(),
        error: new ValidationError('Payload validation failed', validation.errors),
      };
    }

    const request: HandoffRequest = {
      payload,
      targetAgent: decision.targetAgent,
      sourceAgent: options?.sourceAgent,
      timeout: options?.timeout,
      requireExplicitAcceptance: options?.requireExplicitAcceptance,
    };

    const response = await transport.sendHandoff(request);

    if (response.accepted) {
      return {
        success: true,
        handoffId,
        receivingAgent: response.receivingAgent || decision.targetAgent,
        routingDecision: decision,
        timestamp: response.timestamp,
      };
    }

    // Handle rejection — try alternatives if configured
    return this.handleRejection(handoffId, payload, decision, response, options);
  }

  private async handleRejection(
    handoffId: string,
    payload: HandoffPayload,
    decision: PrimaryRoute,
    response: HandoffResponse,
    options?: HandoffOptions
  ): Promise<HandoffResult> {
    // Try next best alternative agent
    for (const alternative of decision.alternatives) {
      const altTransport = this.transportFactory.getTransport(
        alternative,
        options?.preferredTransport
      );
      const altRequest: HandoffRequest = {
        payload,
        targetAgent: alternative,
        sourceAgent: options?.sourceAgent,
        timeout: options?.timeout,
        requireExplicitAcceptance: options?.requireExplicitAcceptance,
      };

      try {
        const altResponse = await altTransport.sendHandoff(altRequest);
        if (altResponse.accepted) {
          return {
            success: true,
            handoffId,
            receivingAgent: altResponse.receivingAgent || alternative,
            routingDecision: { ...decision, targetAgent: alternative },
            timestamp: altResponse.timestamp,
          };
        }
      } catch {
        // Continue to next alternative
      }
    }

    // All alternatives rejected
    return {
      success: false,
      handoffId,
      routingDecision: decision,
      timestamp: new Date(),
      rejectionReason: response.message || 'all_agents_rejected',
    };
  }
}
```

---

## Error Handling

The library uses a typed error hierarchy so callers can handle specific failure modes.

```typescript
export class HandoffError extends Error {
  constructor(
    message: string,
    public readonly code: HandoffErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'HandoffError';
  }
}

export type HandoffErrorCode =
  | 'transport_error'
  | 'validation_error'
  | 'timeout_error'
  | 'rejection_error'
  | 'routing_error'
  | 'compression_error'
  | 'configuration_error'
  | 'unknown_error';

export class TransportError extends HandoffError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'transport_error', details);
  }
}

export class ValidationError extends HandoffError {
  constructor(
    message: string,
    public readonly validationErrors: string[]
  ) {
    super(message, 'validation_error', { validationErrors });
  }
}

export class TimeoutError extends HandoffError {
  constructor(
    message: string,
    public readonly timeoutMs: number
  ) {
    super(message, 'timeout_error', { timeoutMs });
  }
}

export class RejectionError extends HandoffError {
  constructor(
    message: string,
    public readonly rejectionReason: string
  ) {
    super(message, 'rejection_error', { rejectionReason });
  }
}

export class RoutingError extends HandoffError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'routing_error', details);
  }
}

export class CompressionError extends HandoffError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'compression_error', details);
  }
}

export class ConfigurationError extends HandoffError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'configuration_error', details);
  }
}
```

### Retry Utility

```typescript
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries: number;
    backoff: 'linear' | 'exponential';
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry: (error: unknown) => boolean;
  }
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === options.maxRetries || !options.shouldRetry(error)) {
        throw error;
      }

      const delay = calculateDelay(attempt, options);
      await sleep(delay);
    }
  }

  throw lastError;
}
```

**Note**: Circuit breakers and dead letter queues are intentionally excluded from v1. They can be added by users via event hooks or in v1.1.

---

## Observability

Instead of a bespoke metrics service, the library emits typed events. Users wire their own observability stack (OpenTelemetry, Datadog, console logs) via event handlers.

```typescript
export interface HandoffEventMap {
  handoffStart: (event: { handoffId: string; sessionId: string; trigger: HandoffTrigger }) => void;

  handoffComplete: (event: {
    handoffId: string;
    duration: number;
    receivingAgent: AgentCapabilities;
    routingDecision: RoutingDecision;
  }) => void;

  handoffReject: (event: {
    handoffId: string;
    duration: number;
    reason?: string;
    routingDecision: RoutingDecision;
  }) => void;

  handoffError: (event: { handoffId: string; error: HandoffError }) => void;
}
```

### Usage Example

```typescript
const manager = new HandoffManager(config);

manager.on('handoffComplete', ({ handoffId, duration, receivingAgent }) => {
  metrics.histogram('handoff.duration', duration);
  metrics.increment('handoff.success');
  logger.info('Handoff completed', { handoffId, agent: receivingAgent.agentId });
});

manager.on('handoffReject', ({ handoffId, reason }) => {
  metrics.increment('handoff.rejected');
  logger.warn('Handoff rejected', { handoffId, reason });
});
```

This keeps the library dependency-free and avoids opinionated observability stacks.

---

## Data Flow

### Successful Handoff Flow

```
1. Application calls HandoffManager.executeHandoff(context)
   └─> Emits 'handoffStart' event

2. Context Compression
   └─> ContextCompressor.compress(messages) → CompressedContext

3. Routing Decision
   └─> HandoffRouter.route(payload, agents) → PrimaryRoute

4. Transport Selection
   └─> TransportFactory selects MCP or A2A based on agent metadata

5. Validation
   └─> HandoffValidator.validatePayload(payload, targetAgent)

6. Payload Delivery
   └─> TransportLayer.sendHandoff(request) → HandoffResponse

7. Acceptance
   └─> If accepted: emit 'handoffComplete', return HandoffResult(success: true)
   └─> If rejected: try alternatives → emit 'handoffReject', return HandoffResult(success: false)
```

### Rejection Handling Flow

```
1. Target agent rejects handoff
   └─> HandoffResponse(accepted: false)

2. Executor tries next best alternative agent (if any)
   └─> Repeat transport + validation for each alternative

3. If all alternatives reject
   └─> Return HandoffResult with rejectionReason
   └─> Caller decides: fallback to generalist, queue, or escalate
```

---

## Configuration

### Handoff Configuration Schema

```typescript
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
```

### Defaults

```typescript
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
```

---

## Security Considerations

1. **Input Validation**: All payloads are validated with Zod schemas (if available) or manual checks before transport.
2. **PII Masking**: The `SummaryCompressor` can accept an optional `maskPII` callback injected by the user.
3. **Transport Security**: A2A transport assumes HTTPS endpoints. MCP transport relies on the MCP SDK's built-in auth.
4. **Audit Trail**: The event emitter provides complete lifecycle events; users log them for compliance.
5. **Timeout & Limits**: Configurable timeouts and max payload sizes prevent resource exhaustion.

**Out of scope for v1**: Rate limiting, advanced encryption, GDPR automation. These can be implemented by users via event hooks and middleware.

---

## Performance Optimizations

1. **Lazy Loading**: Agent capabilities are loaded on first use and cached with TTL.
2. **Token Estimation**: Fast heuristic token counter (no heavy ML dependencies).
3. **Streaming-friendly**: Compression works on arrays of messages without loading entire conversation histories into intermediate strings.
4. **Connection Reuse**: A2A transport accepts an injectable `HttpClient` so users can provide connection-pooled instances.
5. **Minimal Allocations**: Event emitter uses a simple Map-based subscription; no external event library.

---

## Testing Strategy

### Unit Tests

- Type system validation (compile-time via `tsc --noEmit`)
- Compression algorithm correctness (fixture-based)
- Routing logic accuracy (mocked agent registry)
- Error handling coverage

### Integration Tests

- End-to-end handoff flows with mock MCP server
- End-to-end handoff flows with mock HTTP server
- Rejection handling with multiple alternatives
- Timeout scenarios

### Performance Tests

- Compression latency: 100 / 500 / 1000 message histories
- Routing decision latency with 10/50/100 registered agents
- Concurrent handoff throughput

---

## Future Extensibility

The following are explicitly **not** in v1 but the architecture leaves extension points:

1. **Circuit Breaker**: Can wrap `TransportLayer.sendHandoff()` via decorator pattern.
2. **WebSocket Transport**: Add a `WebSocketTransport` implementing `TransportLayer`.
3. **Distributed Tracing**: Attach trace context to `HandoffPayload.customData`.
4. **Plugin Architecture**: v2 may add a formal plugin registry for compressors/routers.
5. **Multi-hop Handoffs**: Chain `HandoffResult` into a new `HandoffContext`.
6. **Custom Metrics**: Users already have full metrics via event hooks; a built-in metrics adapter may be added later.

---

This architecture provides a solid, minimal foundation for a robust agent handoff library. It handles the critical path—compress, route, transport, validate, accept/reject—without unnecessary infrastructure complexity.
