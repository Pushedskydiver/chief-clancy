/**
 * Generic endpoint ping with HTTP status code mapping.
 */
import type { PingResult } from '~/c/types/index.js';

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
};

/**
 * Ping an API endpoint and map common HTTP error codes to messages.
 *
 * Returns `{ ok: true }` on success, or `{ ok: false, error }` with
 * a human-readable message on failure. Includes a 10s timeout.
 *
 * @param opts - URL, headers, status-to-error map, and network error message.
 * @returns A ping result with `ok` and optional `error`.
 */
export async function pingEndpoint(
  opts: PingEndpointOpts,
): Promise<PingResult> {
  const { url, headers, statusErrors, networkError } = opts;

  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    // Drain body to release the connection back to the pool
    await response.arrayBuffer().catch(() => {});

    if (response.ok) return { ok: true };

    const mapped = statusErrors[response.status];
    return mapped
      ? { ok: false, error: mapped }
      : { ok: false, error: `✗ HTTP ${response.status}` };
  } catch {
    return { ok: false, error: networkError };
  }
}
