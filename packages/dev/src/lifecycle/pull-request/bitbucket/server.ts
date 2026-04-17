/**
 * Bitbucket Server / Data Center pull request operations.
 *
 * Auth: Bearer token (personal access token).
 */
import type { BitbucketServerComment } from '@chief-clancy/core/schemas/bitbucket.js';
import type {
  PrCreationResult,
  PrReviewState,
} from '@chief-clancy/core/types/remote.js';

import {
  bitbucketServerActivitiesSchema,
  bitbucketServerPrCreatedSchema,
  bitbucketServerPrListSchema,
} from '@chief-clancy/core/schemas/bitbucket.js';

import { postPullRequest } from '../post-pr/post-pr.js';
import {
  extractReworkContent,
  isClancyComment,
  isReworkComment,
} from '../rework-comment/rework-comment.js';

/** Minimal fetch signature for Bitbucket API calls. */
type BbFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Options for {@link createServerPullRequest}. */
type CreateServerPrOpts = {
  readonly fetchFn: BbFetch;
  readonly token: string;
  readonly apiBase: string;
  readonly projectKey: string;
  readonly repoSlug: string;
  readonly sourceBranch: string;
  readonly targetBranch: string;
  readonly title: string;
  readonly description: string;
};

/** Options for {@link postServerPrComment}. */
type PostServerCommentOpts = {
  readonly fetchFn: BbFetch;
  readonly token: string;
  readonly apiBase: string;
  readonly projectKey: string;
  readonly repoSlug: string;
  readonly prId: number;
  readonly body: string;
};

/** Options for {@link checkServerPrReviewState}. */
type CheckServerOpts = {
  readonly fetchFn: BbFetch;
  readonly token: string;
  readonly apiBase: string;
  readonly projectKey: string;
  readonly repoSlug: string;
  readonly branch: string;
  readonly since?: string;
};

/** Options for {@link fetchServerPrReviewComments}. */
type FetchServerCommentsOpts = {
  readonly fetchFn: BbFetch;
  readonly token: string;
  readonly apiBase: string;
  readonly projectKey: string;
  readonly repoSlug: string;
  readonly prId: number;
  readonly since?: string;
};

/**
 * Create a pull request on Bitbucket Server / Data Center.
 *
 * @param opts - Server PR creation options.
 * @returns A result with the PR URL and ID on success, or an error.
 */
export async function createServerPullRequest(
  opts: CreateServerPrOpts,
): Promise<PrCreationResult> {
  const { fetchFn, token, apiBase, projectKey, repoSlug } = opts;
  const { sourceBranch, targetBranch, title, description } = opts;

  return postPullRequest({
    fetchFn,
    url: `${apiBase}/projects/${encodeURIComponent(projectKey)}/repos/${encodeURIComponent(repoSlug)}/pull-requests`,
    headers: { Authorization: `Bearer ${token}` },
    body: {
      title,
      description,
      fromRef: {
        id: `refs/heads/${sourceBranch}`,
        repository: { slug: repoSlug, project: { key: projectKey } },
      },
      toRef: {
        id: `refs/heads/${targetBranch}`,
        repository: { slug: repoSlug, project: { key: projectKey } },
      },
    },
    parseSuccess: (json) => {
      const data = bitbucketServerPrCreatedSchema.parse(json);
      return { url: data.links?.self?.[0]?.href ?? '', number: data.id ?? 0 };
    },
    isAlreadyExists: (status, text) =>
      status === 409 &&
      (text.includes('already exists') ||
        text.includes('Only one pull request')),
  });
}

/**
 * Post a comment on a Bitbucket Server/DC pull request.
 *
 * Best-effort — never throws.
 *
 * @param opts - Server comment options.
 * @returns `true` on success, `false` on error.
 */
export async function postServerPrComment(
  opts: PostServerCommentOpts,
): Promise<boolean> {
  const { fetchFn, token, apiBase, projectKey, repoSlug, prId, body } = opts;

  try {
    const res = await fetchFn(
      `${apiBase}/projects/${encodeURIComponent(projectKey)}/repos/${encodeURIComponent(repoSlug)}/pull-requests/${prId}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: body }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Check the review state of an open PR on Bitbucket Server/DC.
 *
 * Inline comments (with `anchor` property) always trigger rework.
 * Conversation comments only trigger when prefixed with `Rework:`.
 * Does not check formal approval state — only GitHub checks formal
 * reviews (CHANGES_REQUESTED) via the reviews API.
 *
 * @param opts - Server review state options.
 * @returns The review state, or `undefined` if no open PR or on error.
 */
export async function checkServerPrReviewState(
  opts: CheckServerOpts,
): Promise<PrReviewState | undefined> {
  const { fetchFn, token, apiBase, projectKey, repoSlug, branch, since } = opts;
  const auth = `Bearer ${token}`;

  try {
    const prRes = await fetchFn(
      `${apiBase}/projects/${encodeURIComponent(projectKey)}/repos/${encodeURIComponent(repoSlug)}/pull-requests?state=OPEN&at=${encodeURIComponent(`refs/heads/${branch}`)}`,
      { headers: { Authorization: auth } },
    );
    if (!prRes.ok) return undefined;

    const parsed = bitbucketServerPrListSchema.parse(await prRes.json());
    if (parsed.values.length === 0) return undefined;

    const pr = parsed.values[0];
    const activities = await fetchActivities({
      fetchFn,
      auth,
      apiBase,
      projectKey,
      repoSlug,
      prId: pr.id,
    });
    if (!activities) return undefined;

    const relevant = filterBySince(activities, since).filter(
      (c) => !isClancyComment(c.text),
    );
    const hasInline = relevant.some((c) => c.anchor != null);
    const hasReworkConvo = relevant.some(
      (c) => c.anchor == null && isReworkComment(c.text),
    );

    return {
      hasChangesRequested: hasInline || hasReworkConvo,
      prNumber: pr.id,
      prUrl: pr.links.self?.[0]?.href ?? '',
    };
  } catch {
    return undefined;
  }
}

/**
 * Fetch feedback comments from a Bitbucket Server/DC PR.
 *
 * Inline comments are always included (prefixed with `[path]`).
 * Conversation comments only when prefixed with `Rework:` (prefix stripped).
 *
 * @param opts - Server comment fetch options.
 * @returns Array of feedback strings, or `[]` on error.
 */
export async function fetchServerPrReviewComments(
  opts: FetchServerCommentsOpts,
): Promise<readonly string[]> {
  const { fetchFn, token, apiBase, projectKey, repoSlug, prId, since } = opts;
  const auth = `Bearer ${token}`;

  try {
    const activities = await fetchActivities({
      fetchFn,
      auth,
      apiBase,
      projectKey,
      repoSlug,
      prId,
    });
    if (!activities) return [];

    return filterBySince(activities, since)
      .filter((c) => !isClancyComment(c.text))
      .flatMap((c) => formatComment(c));
  } catch {
    return [];
  }
}

// ─── private helpers ────────────────────────────────────────────────────────

/** Options for {@link fetchActivities}. */
type FetchActivitiesOpts = {
  readonly fetchFn: BbFetch;
  readonly auth: string;
  readonly apiBase: string;
  readonly projectKey: string;
  readonly repoSlug: string;
  readonly prId: number;
};

/** Fetch Server PR activities and extract comments. Returns `undefined` on error. */
async function fetchActivities(
  opts: FetchActivitiesOpts,
): Promise<readonly BitbucketServerComment[] | undefined> {
  const { fetchFn, auth, apiBase, projectKey, repoSlug, prId } = opts;

  const res = await fetchFn(
    `${apiBase}/projects/${encodeURIComponent(projectKey)}/repos/${encodeURIComponent(repoSlug)}/pull-requests/${prId}/activities?limit=100`,
    { headers: { Authorization: auth } },
  );
  if (!res.ok) return undefined;

  const parsed = bitbucketServerActivitiesSchema.parse(await res.json());
  return parsed.values
    .filter((a) => a.action === 'COMMENTED' && a.comment != null)
    .map((a) => a.comment!);
}

/** Filter comments by since timestamp (milliseconds epoch). */
function filterBySince(
  comments: readonly BitbucketServerComment[],
  since?: string,
): readonly BitbucketServerComment[] {
  if (!since) return comments;
  const sinceMs = Date.parse(since);
  return comments.filter((c) => c.createdDate > sinceMs);
}

/** Format a comment into a feedback string, or empty if not actionable. */
function formatComment(c: BitbucketServerComment): readonly string[] {
  if (c.anchor != null) {
    const prefix = c.anchor.path ? `[${c.anchor.path}] ` : '';
    return [`${prefix}${c.text}`];
  }

  if (isReworkComment(c.text)) {
    return [extractReworkContent(c.text)];
  }

  return [];
}
