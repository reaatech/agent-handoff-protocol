import { describe, expect, it } from 'vitest';
import {
  CompressionError,
  ConfigurationError,
  HandoffError,
  RejectionError,
  RoutingError,
  TimeoutError,
  TransportError,
  ValidationError,
} from './errors.js';

describe('error hierarchy', () => {
  it('HandoffError has code and details', () => {
    const error = new HandoffError('test', 'unknown_error', { foo: 1 });
    expect(error.message).toBe('test');
    expect(error.code).toBe('unknown_error');
    expect(error.details).toEqual({ foo: 1 });
    expect(error.name).toBe('HandoffError');
  });

  it('TransportError extends HandoffError', () => {
    const error = new TransportError('conn failed', { host: 'x' });
    expect(error.code).toBe('transport_error');
    expect(error.details).toEqual({ host: 'x' });
  });

  it('ValidationError includes validationErrors', () => {
    const error = new ValidationError('bad', ['a', 'b']);
    expect(error.code).toBe('validation_error');
    expect(error.validationErrors).toEqual(['a', 'b']);
    expect(error.details).toEqual({ validationErrors: ['a', 'b'] });
  });

  it('TimeoutError includes timeoutMs', () => {
    const error = new TimeoutError('slow', 5000);
    expect(error.code).toBe('timeout_error');
    expect(error.timeoutMs).toBe(5000);
  });

  it('RejectionError includes rejectionReason', () => {
    const error = new RejectionError('no', 'busy');
    expect(error.code).toBe('rejection_error');
    expect(error.rejectionReason).toBe('busy');
  });

  it('RoutingError extends HandoffError', () => {
    const error = new RoutingError('no route', { agentId: 'x' });
    expect(error.code).toBe('routing_error');
  });

  it('CompressionError extends HandoffError', () => {
    const error = new CompressionError('too big');
    expect(error.code).toBe('compression_error');
  });

  it('ConfigurationError extends HandoffError', () => {
    const error = new ConfigurationError('missing');
    expect(error.code).toBe('configuration_error');
  });
});
