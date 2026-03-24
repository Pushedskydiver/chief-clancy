/**
 * Fetch with automatic retry for transient failures.
 *
 * Handles 429 (rate limited) with Retry-After header, 5xx with exponential
 * backoff, and network errors. Non-retryable responses (4xx other than 429)
 * are returned immediately.
 */

/** Options for retry behaviour. */
export type RetryOptions = {
  /** Maximum number of retry attempts (excludes the initial attempt). Default: 3. */
  readonly maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff. Default: 1000. */
  readonly baseDelayMs?: number;
  /** Maximum delay in milliseconds. Default: 10000. */
  readonly maxDelayMs?: number;
};

/** Resolved retry config with defaults applied. */
type RetryConfig = {
  readonly url: string;
  readonly init: RequestInit | undefined;
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
};

/**
 * Parse a Retry-After header value into milliseconds.
 *
 * Supports both delta-seconds (e.g. "120") and HTTP-date formats.
 * Returns `undefined` if the header is missing or unparseable.
 */
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;

  const seconds = parseInt(header, 10);
  if (!Number.isNaN(seconds) && seconds >= 0) return seconds * 1000;

  const date = new Date(header);
  if (!Number.isNaN(date.getTime())) {
    const delayMs = date.getTime() - Date.now();
    return delayMs > 0 ? delayMs : 0;
  }

  return undefined;
}

/** Compute exponential backoff delay, capped at maxDelayMs. */
function backoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  return Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
}

/** Whether an HTTP status code is retryable. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

/** Compute the retry delay for a retryable response. */
function retryDelay(
  response: Response,
  config: RetryConfig,
  attempt: number,
): number {
  if (response.status === 429) {
    const after = parseRetryAfter(response.headers.get('Retry-After'));
    return (
      after ?? backoffDelay(attempt, config.baseDelayMs, config.maxDelayMs)
    );
  }
  return backoffDelay(attempt, config.baseDelayMs, config.maxDelayMs);
}

/** Wait for a given number of milliseconds. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Recursive retry implementation. */
async function attemptFetch(
  config: RetryConfig,
  attempt: number,
): Promise<Response> {
  try {
    const response = await fetch(config.url, config.init);

    if (!isRetryableStatus(response.status)) return response;
    if (attempt >= config.maxRetries) return response;

    const ms = retryDelay(response, config, attempt);
    await response.arrayBuffer().catch(() => {});
    await delay(ms);

    return attemptFetch(config, attempt + 1);
  } catch (err) {
    if (attempt >= config.maxRetries) throw err;

    const ms = backoffDelay(attempt, config.baseDelayMs, config.maxDelayMs);
    await delay(ms);

    return attemptFetch(config, attempt + 1);
  }
}

/**
 * Fetch with automatic retry for transient failures.
 *
 * - On 429 (rate limited): honours `Retry-After` header, then retries.
 * - On 5xx: retries with exponential backoff.
 * - On other errors: returns the response immediately (no retry).
 * - On network error (fetch throws): retries with exponential backoff.
 * - After `maxRetries` exhausted: returns the last response or throws
 *   the last network error.
 *
 * @param url - The URL to fetch.
 * @param init - Optional fetch init (method, headers, body, etc.).
 * @param opts - Retry behaviour options.
 * @returns The fetch Response.
 */
export async function retryFetch(
  url: string,
  init?: RequestInit,
  opts?: RetryOptions,
): Promise<Response> {
  const config: RetryConfig = {
    url,
    init,
    maxRetries: Math.max(0, opts?.maxRetries ?? 3),
    baseDelayMs: opts?.baseDelayMs ?? 1000,
    maxDelayMs: opts?.maxDelayMs ?? 10_000,
  };

  return attemptFetch(config, 0);
}
