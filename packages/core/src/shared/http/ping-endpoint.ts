/**
 * Generic endpoint ping with HTTP status code mapping.
 */
import type { Fetcher } from './fetch-and-parse.js';
import type { PingResult } from '~/c/types/board.js';

/** Options for {@link pingEndpoint}. */
export type PingEndpointOpts = {
  /** The URL to ping. */
  readonly url: string;
  /** HTTP headers to send. */
  readonly headers: Record<string, string>;
  /** Map of HTTP status codes to error messages. */
  readonly statusErrors: Record<number, string>;
  /** Error message for network failures. */
  readonly networkError: string;
  /** Custom fetch function for DI in tests. */
  readonly fetcher?: Fetcher;
};

/**
 * Ping an API endpoint and map common HTTP error codes to messages.
 *
 * Returns `{ ok: true }` on success, or a tagged failure with
 * `{ kind: 'unknown'; message }` on non-OK status or network failure.
 * Includes a 10s timeout.
 */
export async function pingEndpoint(
  opts: PingEndpointOpts,
): Promise<PingResult> {
  const { url, headers, statusErrors, networkError, fetcher } = opts;
  const doFetch = fetcher ?? fetch;

  try {
    const response = await doFetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    // Drain body to release the connection back to the pool
    await response.arrayBuffer().catch(() => {});

    if (response.ok) return { ok: true };

    const mapped = statusErrors[response.status];
    const message = mapped ?? `✗ HTTP ${response.status}`;
    return { ok: false, error: { kind: 'unknown', message } };
  } catch {
    return { ok: false, error: { kind: 'unknown', message: networkError } };
  }
}
