/**
 * Generic fetch → parse → validate utility.
 *
 * Eliminates the repeated try/fetch/check-ok/parse-json/validate-zod
 * boilerplate across board modules.
 */
import type { ZodMiniType } from 'zod/mini';

/** Injectable fetch function for dependency injection in tests. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** Options for {@link fetchAndParse}. */
export type FetchAndParseOptions<T> = {
  /** Zod schema to validate the response body against. */
  readonly schema: ZodMiniType<T>;
  /** Human-readable label for error messages (e.g., `'Jira API'`). */
  readonly label: string;
  /** Custom fetch function (e.g., `retryFetch`). Defaults to global `fetch`. */
  readonly fetcher?: Fetcher;
};

/** Read a response body snippet for error messages (max 200 chars). */
async function readBodySnippet(response: Response): Promise<string> {
  try {
    const body = await response.text();
    return body ? ` — ${body.slice(0, 200)}` : '';
  } catch {
    return '';
  }
}

/** Format a caught error value into a message string. */
function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Fetch a URL, parse the JSON response, and validate against a Zod schema.
 *
 * Returns the parsed data on success, or `undefined` on any failure
 * (network error, non-OK status, invalid JSON, schema mismatch).
 * All failures are logged to `console.warn` with the provided label.
 *
 * @param url - The URL to fetch.
 * @param init - Standard `fetch` RequestInit options.
 * @param opts - Schema, label, and optional custom fetcher.
 * @returns The parsed and validated data, or `undefined` on failure.
 */
export async function fetchAndParse<T>(
  url: string,
  init: RequestInit | undefined,
  opts: FetchAndParseOptions<T>,
): Promise<T | undefined> {
  const { schema, label, fetcher = fetch } = opts;

  const response = await fetcher(url, init).catch((err: unknown) => {
    console.warn(`⚠ ${label} request failed: ${formatError(err)}`);
    return undefined;
  });

  if (!response) return undefined;

  if (!response.ok) {
    const detail = await readBodySnippet(response);
    console.warn(`⚠ ${label} returned HTTP ${response.status}${detail}`);
    return undefined;
  }

  const json: unknown = await response.json().catch(() => {
    console.warn(`⚠ ${label} returned invalid JSON`);
    return undefined;
  });

  if (json === undefined) return undefined;

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    console.warn(
      `⚠ ${label} unexpected response shape: ${parsed.error.message}`,
    );
    return undefined;
  }

  return parsed.data;
}
