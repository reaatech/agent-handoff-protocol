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
export type { HandoffErrorCode } from './utils/errors.js';

export { TypedEventEmitter } from './utils/events.js';
export type { EventListener } from './utils/events.js';

export { withRetry } from './utils/retry.js';
export type { RetryOptions } from './utils/retry.js';

export { pickDefined } from './utils/pick-defined.js';

export { createHandoffConfig, defaultHandoffConfig } from './config.js';
