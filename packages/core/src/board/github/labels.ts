/**
 * GitHub Issues label operations.
 *
 * GitHub has direct label API endpoints (unlike boards that need
 * read-modify-write via modifyLabelList). All operations are
 * best-effort — they log warnings but never throw.
 */
import type { Fetcher } from '~/c/shared/http/fetch-and-parse.js';

import { GITHUB_API, githubHeaders } from './api.js';

/** Context for GitHub label operations. */
type GitHubLabelContext = {
  readonly token: string;
  readonly repo: string;
  readonly fetcher?: Fetcher;
};

/** Format a caught error value into a warning message. */
function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Ensure a label exists on the repository. Creates it if missing.
 *
 * @param ctx - Token and repo context.
 * @param label - The label name to ensure.
 * @returns Resolves when complete (best-effort — never throws).
 */
export async function ensureLabel(
  ctx: GitHubLabelContext,
  label: string,
): Promise<void> {
  try {
    const headers = githubHeaders(ctx.token);
    const doFetch = ctx.fetcher ?? fetch;
    const url = `${GITHUB_API}/repos/${ctx.repo}/labels/${encodeURIComponent(label)}`;
    const res = await doFetch(url, { headers });

    if (res.ok) return;

    if (res.status === 404) {
      await createLabel(ctx, label, headers);
    } else {
      console.warn(`⚠ ensureLabel GET returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`⚠ ensureLabel failed: ${formatError(err)}`);
  }
}

/** Create a new label on the repository. */
async function createLabel(
  ctx: GitHubLabelContext,
  label: string,
  headers: Record<string, string>,
): Promise<void> {
  const doFetch = ctx.fetcher ?? fetch;
  const res = await doFetch(`${GITHUB_API}/repos/${ctx.repo}/labels`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: label, color: '0075ca' }),
  });

  // 422 = label already exists (race condition)
  if (!res.ok && res.status !== 422) {
    console.warn(`⚠ ensureLabel create returned HTTP ${res.status}`);
  }
}

/**
 * Add a label to a GitHub issue.
 *
 * @param ctx - Token and repo context.
 * @param issueNumber - The issue number.
 * @param label - The label name to add.
 * @returns Resolves when complete (best-effort — never throws).
 */
export async function addLabel(
  ctx: GitHubLabelContext,
  issueNumber: number,
  label: string,
): Promise<void> {
  try {
    const headers = githubHeaders(ctx.token);
    const doFetch = ctx.fetcher ?? fetch;
    const res = await doFetch(
      `${GITHUB_API}/repos/${ctx.repo}/issues/${issueNumber}/labels`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels: [label] }),
      },
    );

    if (!res.ok) {
      console.warn(`⚠ addLabel returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`⚠ addLabel failed: ${formatError(err)}`);
  }
}

/**
 * Remove a label from a GitHub issue.
 *
 * @param ctx - Token and repo context.
 * @param issueNumber - The issue number.
 * @param label - The label name to remove.
 * @returns Resolves when complete (best-effort — never throws).
 */
export async function removeLabel(
  ctx: GitHubLabelContext,
  issueNumber: number,
  label: string,
): Promise<void> {
  try {
    const headers = githubHeaders(ctx.token);
    const doFetch = ctx.fetcher ?? fetch;
    const url = `${GITHUB_API}/repos/${ctx.repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`;
    const res = await doFetch(url, { method: 'DELETE', headers });

    // 404 = label not on the issue, ignore
    if (!res.ok && res.status !== 404) {
      console.warn(`⚠ removeLabel returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`⚠ removeLabel failed: ${formatError(err)}`);
  }
}
