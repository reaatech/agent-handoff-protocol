/**
 * Event Hook Usage
 *
 * This example demonstrates how to observe the handoff lifecycle
 * using typed event hooks on HandoffManager.
 */

import {
  HandoffManager,
  createHandoffConfig,
  HandoffError,
} from '@reaatech/agent-handoff-protocol';

// Assume manager is already constructed (see basic-handoff.ts)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function setupObservability(manager: HandoffManager) {
  manager.on('handoffStart', ({ handoffId, sessionId, trigger }) => {
    console.log(`[${handoffId}] Handoff started for session ${sessionId}`);
    console.log(`  Trigger: ${trigger.type}`);
  });

  manager.on('handoffComplete', ({ handoffId, duration, receivingAgent }) => {
    console.log(`[${handoffId}] Handoff completed in ${duration}ms`);
    console.log(`  Receiving agent: ${receivingAgent.agentName} (${receivingAgent.agentId})`);
  });

  manager.on('handoffReject', ({ handoffId, duration, reason, routingDecision }) => {
    console.log(`[${handoffId}] Handoff rejected after ${duration}ms`);
    console.log(`  Reason: ${reason ?? 'unknown'}`);
    console.log(`  Decision type: ${routingDecision.type}`);
  });

  manager.on('handoffError', ({ handoffId, error }) => {
    const code = error instanceof HandoffError ? error.code : 'unknown';
    console.error(`[${handoffId}] Handoff failed: ${error.message} (code: ${code})`);
  });
}

// You can wire these events to your own metrics/tracing system:
// - OpenTelemetry spans
// - Prometheus counters
// - Structured logging (Winston, Pino)
// - Custom analytics pipeline
