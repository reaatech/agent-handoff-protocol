export interface RetryOptions {
  maxRetries: number;
  backoff: 'linear' | 'exponential';
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry: (error: unknown) => boolean;
}

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

  throw lastError;
}

function calculateDelay(attempt: number, options: RetryOptions): number {
  const raw =
    options.backoff === 'linear'
      ? options.baseDelayMs * (attempt + 1)
      : options.baseDelayMs * 2 ** attempt;
  const capped = Math.min(raw, options.maxDelayMs);
  return Math.random() * capped;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}
