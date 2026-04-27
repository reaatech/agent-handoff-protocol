// Core API
export { HandoffManager } from './core/handoff-manager.js';
export { createHandoffConfig, defaultHandoffConfig } from './core/config.js';

// Types
export type {
  DeepPartial,
  Message,
  UserMetadata,
  ConversationState,
  HandoffTrigger,
  ConfidenceTooLow,
  TopicBoundaryCrossed,
  EscalationRequested,
  SpecialistRequired,
  LoadBalancing,
  HandoffPayload,
  CompressedContext,
  KeyFact,
  Intent,
  Entity,
  OpenItem,
  RoutingDecision,
  PrimaryRoute,
  ClarificationRoute,
  FallbackRoute,
  AgentCapabilities,
  Specialization,
  AvailabilityStatus,
  TransportLayer,
  TransportCapabilities,
  HandoffRequest,
  HandoffResponse,
  HandoffConfig,
  CompressionOptions,
  MaskPIICallback,
  ContextCompressor,
  HandoffRouter,
  HandoffContext,
  HandoffOptions,
  HandoffResult,
} from './types/index.js';

// Compression
export { HybridCompressor } from './compression/hybrid-compressor.js';
export { SummaryCompressor } from './compression/summary-compressor.js';
export { SlidingWindowCompressor } from './compression/sliding-window-compressor.js';
export { SimpleTokenCounter } from './compression/context-compressor.js';

// Routing
export { CapabilityBasedRouter } from './routing/handoff-router.js';
export { AgentRegistry } from './routing/agent-registry.js';

// Transport
export { MCPTransport } from './transport/mcp-transport.js';
export { A2ATransport } from './transport/a2a-transport.js';
export { TransportFactory } from './transport/transport-factory.js';

// Validation
export { HandoffValidator } from './validation/handoff-validator.js';

// Utils
export {
  HandoffError,
  TransportError,
  ValidationError,
  TimeoutError,
  RejectionError,
  RoutingError,
  CompressionError,
  ConfigurationError,
} from './utils/errors.js';
export { withRetry } from './utils/retry.js';
export { TypedEventEmitter } from './utils/events.js';
export { pickDefined } from './utils/pick-defined.js';
