export interface RetryOptions {
  maxRetries: number;
  backoff: 'linear' | 'exponential';
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry: (error: unknown) => boolean;
}

/**
 * Retry an async operation with exponential backoff and full jitter.
 *
 * @param operation - The async function to retry.
 * @param options - Retry configuration including max retries, backoff strategy, and delay bounds.
 * @returns The result of the operation.
 * @throws The last error if all retries are exhausted.
 */
export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
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

  // This line is unreachable in practice because the loop always throws,
  // but TypeScript needs it for strict return-type checking.
  throw lastError;
}

function calculateDelay(attempt: number, options: RetryOptions): number {
  const raw =
    options.backoff === 'linear'
      ? options.baseDelayMs * (attempt + 1)
      : options.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(raw, options.maxDelayMs);
  return Math.random() * capped; // full jitter
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}
