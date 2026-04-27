import type {
  HandoffContext,
  HandoffOptions,
  HandoffResult,
  AgentCapabilities,
  HandoffRouter,
  ContextCompressor,
  HandoffConfig,
} from '../types/index.js';
import { TransportFactory } from '../transport/transport-factory.js';
import { TypedEventEmitter } from '../utils/events.js';
import { HandoffExecutor } from './handoff-executor.js';
import { HandoffValidator } from '../validation/handoff-validator.js';
import { AgentRegistry } from '../routing/agent-registry.js';
import { CapabilityBasedRouter } from '../routing/handoff-router.js';
import { HybridCompressor } from '../compression/hybrid-compressor.js';

import type { HandoffTrigger } from '../types/triggers.js';
import type { RoutingDecision } from '../types/routing.js';

export interface HandoffEventMap {
  handoffStart: {
    handoffId: string;
    sessionId: string;
    trigger: HandoffTrigger;
  };

  handoffComplete: {
    handoffId: string;
    duration: number;
    receivingAgent: AgentCapabilities;
    routingDecision: RoutingDecision;
  };

  handoffReject: {
    handoffId: string;
    duration: number;
    reason?: string;
    routingDecision: RoutingDecision;
  };

  handoffError: {
    handoffId: string;
    error: Error;
  };
}

/**
 * Primary entry point for executing handoffs between agents.
 *
 * Orchestrates the full handoff lifecycle: compression, routing,
 * validation, transport, and rejection handling. Emits typed lifecycle
 * events that can be observed for logging, metrics, or tracing.
 *
 * Agents can be pre-registered via {@link registerAgent} and will be
 * merged with any `availableAgents` supplied at execution time.
 *
 * @example
 * ```ts
 * const manager = new HandoffManager(config, {
 *   router: new CapabilityBasedRouter(config.routing),
 *   compressor: new HybridCompressor(),
 *   transportFactory,
 * });
 *
 * manager.registerAgent(billingAgent);
 *
 * manager.on('handoffComplete', ({ handoffId, duration }) => {
 *   console.log(`Handoff ${handoffId} completed in ${duration}ms`);
 * });
 *
 * const result = await manager.executeHandoff(context);
 * ```
 */
export class HandoffManager {
  private readonly eventEmitter: TypedEventEmitter<HandoffEventMap>;
  private readonly executor: HandoffExecutor;
  private readonly agentRegistry: AgentRegistry;
  readonly config: HandoffConfig;

  constructor(
    config: HandoffConfig,
    deps?: {
      router?: HandoffRouter;
      compressor?: ContextCompressor;
      transportFactory?: TransportFactory;
    }
  ) {
    this.config = config;
    this.eventEmitter = new TypedEventEmitter<HandoffEventMap>();
    this.agentRegistry = new AgentRegistry();

    const router = deps?.router ?? new CapabilityBasedRouter(config.routing);
    const compressor = deps?.compressor ?? new HybridCompressor();
    const transportFactory = deps?.transportFactory ?? new TransportFactory([]);
    const validator = new HandoffValidator();

    this.executor = new HandoffExecutor(
      router,
      compressor,
      validator,
      transportFactory,
      this.eventEmitter
    );
  }

  /**
   * Execute a handoff for the given context and options.
   *
   * Pre-registered agents (see {@link registerAgent}) are automatically
   * appended to `context.availableAgents`.
   */
  async executeHandoff(context: HandoffContext, options?: HandoffOptions): Promise<HandoffResult> {
    const registeredAgents = this.agentRegistry.getAll();
    const mergedContext: HandoffContext =
      registeredAgents.length > 0
        ? {
            ...context,
            availableAgents: [...registeredAgents, ...context.availableAgents],
          }
        : context;

    return this.executor.executeHandoff(mergedContext, options);
  }

  /**
   * Subscribe to a lifecycle event.
   */
  on<E extends keyof HandoffEventMap>(
    event: E,
    handler: (payload: HandoffEventMap[E]) => void
  ): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Subscribe to a lifecycle event for a single invocation.
   */
  once<E extends keyof HandoffEventMap>(
    event: E,
    handler: (payload: HandoffEventMap[E]) => void
  ): void {
    this.eventEmitter.once(event, handler);
  }

  /**
   * Unsubscribe from a lifecycle event.
   */
  off<E extends keyof HandoffEventMap>(
    event: E,
    handler: (payload: HandoffEventMap[E]) => void
  ): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Register an agent's capabilities in the local registry.
   * Registered agents are included in every handoff automatically.
   */
  registerAgent(capabilities: AgentCapabilities): void {
    this.agentRegistry.register(capabilities);
  }

  /**
   * Remove an agent from the local registry.
   */
  unregisterAgent(agentId: string): void {
    this.agentRegistry.unregister(agentId);
  }

  /**
   * Get a copy of all currently registered agents.
   */
  getRegisteredAgents(): AgentCapabilities[] {
    return this.agentRegistry.getAll();
  }
}
