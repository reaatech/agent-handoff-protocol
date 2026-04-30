export { HandoffManager } from './handoff-manager.js';
export type { HandoffEventMap } from './handoff-manager.js';
export { HandoffExecutor } from './handoff-executor.js';

// Re-export everything from sub-packages for convenience
export {
  createHandoffConfig,
  defaultHandoffConfig,
  HandoffError,
  TransportError,
  ValidationError,
  TimeoutError,
  RejectionError,
  RoutingError,
  CompressionError,
  ConfigurationError,
  TypedEventEmitter,
  withRetry,
  pickDefined,
} from '@reaatech/agent-handoff';
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
  HandoffErrorCode,
  EventListener,
  RetryOptions,
} from '@reaatech/agent-handoff';

export {
  HybridCompressor,
  SummaryCompressor,
  SlidingWindowCompressor,
  SimpleTokenCounter,
  BaseCompressor,
} from '@reaatech/agent-handoff-compression';
export type { TokenCounter, CompressionStrategy } from '@reaatech/agent-handoff-compression';

export { CapabilityBasedRouter, AgentRegistry } from '@reaatech/agent-handoff-routing';

export {
  MCPTransport,
  A2ATransport,
  TransportFactory,
} from '@reaatech/agent-handoff-transport';

export { HandoffValidator } from '@reaatech/agent-handoff-validation';
export { classifyRejectionReason } from '@reaatech/agent-handoff-validation';
export type { RejectionReason } from '@reaatech/agent-handoff-validation';
