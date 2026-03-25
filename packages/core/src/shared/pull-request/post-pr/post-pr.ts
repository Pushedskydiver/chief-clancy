/**
 * Shared pull request creation utility.
 *
 * Wraps the common POST + error-handling pattern used by all three
 * git host PR creation functions (GitHub, GitLab, Bitbucket).
 * Fetch is dependency-injected for testability.
 */
import type { PrCreationResult } from '~/c/types/index.js';

/** Minimal fetch signature needed for PR creation. */
type PostPrFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Options for {@link postPullRequest}. */
type PostPrOpts = {
  readonly fetchFn: PostPrFetch;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Readonly<Record<string, unknown>>;
  readonly parseSuccess: (json: unknown) => {
    readonly url: string;
    readonly number: number;
  };
  readonly isAlreadyExists?: (status: number, text: string) => boolean;
};

/** Timeout in milliseconds for PR creation requests. */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * POST a pull request / merge request and return a typed result.
 *
 * Handles the common try/catch, response parsing, error formatting,
 * and "already exists" detection shared by all git host implementations.
 *
 * @param opts - Request options including fetch, URL, headers, body, and callbacks.
 * @returns A typed `PrCreationResult`.
 */
export async function postPullRequest(
  opts: PostPrOpts,
): Promise<PrCreationResult> {
  const { fetchFn, url, headers, body, parseSuccess, isAlreadyExists } = opts;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const alreadyExists = isAlreadyExists?.(response.status, text) ?? false;

      return {
        ok: false,
        error: `HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        alreadyExists,
      };
    }

    const json: unknown = await response.json();
    const parsed = parseSuccess(json);

    if (!parsed.url && !parsed.number) {
      return {
        ok: false,
        error: 'PR created but response missing URL and number',
      };
    }

    return { ok: true, url: parsed.url, number: parsed.number };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Build a Basic Auth header value from username and token.
 *
 * Used by Bitbucket Cloud which requires HTTP Basic Auth.
 */
export function basicAuth(username: string, token: string): string {
  return `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`;
}
