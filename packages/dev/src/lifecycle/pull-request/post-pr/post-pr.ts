/**
 * Shared pull request creation utility.
 *
 * Wraps the common POST + error-handling pattern used by all
 * git host PR creation functions (GitHub, GitLab, Bitbucket, Azure DevOps).
 * Fetch is dependency-injected for testability.
 */
import type { PrCreationResult } from '@chief-clancy/core/types/remote.js';

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
      const message = `HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`;

      return {
        ok: false,
        error: { kind: 'unknown', message },
        alreadyExists,
      };
    }

    const json: unknown = await response.json();
    const parsed = parseSuccess(json);

    if (!parsed.url || !parsed.number) {
      return {
        ok: false,
        error: {
          kind: 'unknown',
          message: 'PR created but response missing URL or number',
        },
      };
    }

    return { ok: true, url: parsed.url, number: parsed.number };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: { kind: 'unknown', message },
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Build a Basic Auth header value from username and token.
 *
 * Used by Bitbucket Cloud and Azure DevOps for HTTP Basic Auth.
 *
 * @param username - The username (empty string for AzDO PAT auth).
 * @param token - The token or app password.
 * @returns The `Basic {base64}` header value.
 */
export function basicAuth(username: string, token: string): string {
  return `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`;
}
