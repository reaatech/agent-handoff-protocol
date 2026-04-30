import type {
  ContextCompressor,
  HandoffContext,
  HandoffOptions,
  HandoffPayload,
  HandoffRequest,
  HandoffResult,
  HandoffRouter,
  PrimaryRoute,
  RoutingDecision,
} from '@reaatech/agent-handoff';
import { HandoffError, ValidationError } from '@reaatech/agent-handoff';
import { pickDefined } from '@reaatech/agent-handoff';
import type { TypedEventEmitter } from '@reaatech/agent-handoff';
import type { TransportFactory } from '@reaatech/agent-handoff-transport';
import type { HandoffValidator } from '@reaatech/agent-handoff-validation';
import type { HandoffEventMap } from './handoff-manager.js';

export class HandoffExecutor {
  constructor(
    private readonly router: HandoffRouter,
    private readonly compressor: ContextCompressor,
    private readonly validator: HandoffValidator,
    private readonly transportFactory: TransportFactory,
    private readonly eventEmitter: TypedEventEmitter<HandoffEventMap>,
  ) {}

  async executeHandoff(context: HandoffContext, options?: HandoffOptions): Promise<HandoffResult> {
    const handoffId = this.generateHandoffId();
    const startTime = Date.now();
    let routingDecision: RoutingDecision | undefined;

    this.eventEmitter.emit('handoffStart', {
      handoffId,
      sessionId: context.sessionId,
      trigger: context.trigger,
    });

    try {
      const compressedContext = await this.compressor.compress(
        context.messages,
        options?.compressionOptions,
      );

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
        ...pickDefined({ expiresAt: options?.expiresAt }),
      };

      routingDecision = await this.router.route(payload, context.availableAgents);

      const result = await this.executeByDecisionType(handoffId, payload, routingDecision, options);

      const duration = Date.now() - startTime;

      if (result.success && result.receivingAgent) {
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
          ...(result.rejectionReason !== undefined ? { reason: result.rejectionReason } : {}),
          routingDecision,
        });
      }

      return result;
    } catch (error) {
      const handoffError =
        error instanceof HandoffError
          ? error
          : new HandoffError('Unexpected error during handoff', 'unknown_error', {
              cause: error instanceof Error ? error.message : String(error),
            });

      const fallbackDecision: RoutingDecision = routingDecision ?? {
        type: 'fallback',
        reason: 'unexpected_error',
      };

      this.eventEmitter.emit('handoffError', { handoffId, error: handoffError });

      return {
        success: false,
        handoffId,
        routingDecision: fallbackDecision,
        timestamp: new Date(),
        error: handoffError,
        rejectionReason:
          fallbackDecision.type === 'fallback' ? fallbackDecision.reason : 'unexpected_error',
      };
    }
  }

  private async executeByDecisionType(
    handoffId: string,
    payload: HandoffPayload,
    decision: RoutingDecision,
    options?: HandoffOptions,
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
    options?: HandoffOptions,
  ): Promise<HandoffResult> {
    const transport = this.transportFactory.getTransport(
      decision.targetAgent,
      options?.preferredTransport,
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
      ...pickDefined({
        sourceAgent: options?.sourceAgent,
        timeout: options?.timeout,
        requireExplicitAcceptance: options?.requireExplicitAcceptance,
      }),
    };

    const response = await transport.sendHandoff(request);

    if (response.accepted) {
      return {
        success: true,
        handoffId,
        receivingAgent: response.receivingAgent ?? decision.targetAgent,
        routingDecision: decision,
        timestamp: response.timestamp,
      };
    }

    return this.handleRejection(handoffId, payload, decision, response, options);
  }

  private async handleRejection(
    handoffId: string,
    payload: HandoffPayload,
    decision: PrimaryRoute,
    response: { message?: string },
    options?: HandoffOptions,
  ): Promise<HandoffResult> {
    for (const alternative of decision.alternatives) {
      const altTransport = this.transportFactory.getTransport(
        alternative,
        options?.preferredTransport,
      );
      const altRequest: HandoffRequest = {
        payload,
        targetAgent: alternative,
        ...pickDefined({
          sourceAgent: options?.sourceAgent,
          timeout: options?.timeout,
          requireExplicitAcceptance: options?.requireExplicitAcceptance,
        }),
      };

      try {
        const altResponse = await altTransport.sendHandoff(altRequest);
        if (altResponse.accepted) {
          return {
            success: true,
            handoffId,
            receivingAgent: altResponse.receivingAgent ?? alternative,
            routingDecision: { ...decision, targetAgent: alternative },
            timestamp: altResponse.timestamp,
          };
        }
      } catch {
        // Continue to next alternative
      }
    }

    return {
      success: false,
      handoffId,
      routingDecision: decision,
      timestamp: new Date(),
      rejectionReason: response.message ?? 'all_agents_rejected',
    };
  }

  private handleClarification(
    handoffId: string,
    _payload: HandoffPayload,
    decision: RoutingDecision,
  ): HandoffResult {
    return {
      success: false,
      handoffId,
      routingDecision: decision,
      timestamp: new Date(),
      rejectionReason: 'clarification_required',
    };
  }

  private handleFallback(
    handoffId: string,
    _payload: HandoffPayload,
    decision: RoutingDecision,
  ): HandoffResult {
    return {
      success: false,
      handoffId,
      routingDecision: decision,
      timestamp: new Date(),
      rejectionReason: decision.type === 'fallback' ? decision.reason : 'fallback',
    };
  }

  private generateHandoffId(): string {
    return `handoff-${String(Date.now())}-${crypto.randomUUID().slice(0, 8)}`;
  }
}
