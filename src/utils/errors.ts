export type HandoffErrorCode =
  | 'transport_error'
  | 'validation_error'
  | 'timeout_error'
  | 'rejection_error'
  | 'routing_error'
  | 'compression_error'
  | 'configuration_error'
  | 'unknown_error';

/**
 * Base error class for all handoff-related errors.
 */
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
