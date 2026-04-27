import { describe, it, expect } from 'vitest';
import { withRetry } from '../../../src/utils/retry.js';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const result = await withRetry(async () => Promise.resolve('ok'), {
      maxRetries: 3,
      backoff: 'exponential',
      baseDelayMs: 1,
      maxDelayMs: 10,
      shouldRetry: () => true,
    });
    expect(result).toBe('ok');
  });

  it('retries on failure then succeeds', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) return Promise.reject(new Error('fail'));
        return Promise.resolve('ok');
      },
      {
        maxRetries: 3,
        backoff: 'exponential',
        baseDelayMs: 1,
        maxDelayMs: 10,
        shouldRetry: () => true,
      }
    );
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('throws after max retries exceeded', async () => {
    await expect(
      withRetry(async () => Promise.reject(new Error('always fails')), {
        maxRetries: 2,
        backoff: 'exponential',
        baseDelayMs: 1,
        maxDelayMs: 10,
        shouldRetry: () => true,
      })
    ).rejects.toThrow('always fails');
  });

  it('does not retry when shouldRetry returns false', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          return Promise.reject(new Error('no retry'));
        },
        {
          maxRetries: 3,
          backoff: 'exponential',
          baseDelayMs: 1,
          maxDelayMs: 10,
          shouldRetry: () => false,
        }
      )
    ).rejects.toThrow('no retry');
    expect(attempts).toBe(1);
  });

  it('honors linear backoff', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) return Promise.reject(new Error('fail'));
        return Promise.resolve('ok');
      },
      {
        maxRetries: 3,
        backoff: 'linear',
        baseDelayMs: 1,
        maxDelayMs: 10,
        shouldRetry: () => true,
      }
    );
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('throws when maxRetries is negative', async () => {
    await expect(
      withRetry(() => Promise.resolve('ok'), {
        maxRetries: -1,
        backoff: 'exponential',
        baseDelayMs: 1,
        maxDelayMs: 10,
        shouldRetry: () => true,
      })
    ).rejects.toThrow('Retry exhausted');
  });
});
