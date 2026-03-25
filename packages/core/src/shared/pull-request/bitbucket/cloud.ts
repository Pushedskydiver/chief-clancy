/**
 * Bitbucket Cloud pull request operations.
 *
 * Auth: HTTP Basic Auth (username:apppassword).
 */
import type { BitbucketComment } from '~/c/schemas/bitbucket/bitbucket.js';
import type { PrCreationResult, PrReviewState } from '~/c/types/index.js';

import {
  bitbucketCommentsSchema,
  bitbucketPrCreatedSchema,
  bitbucketPrListSchema,
} from '~/c/schemas/bitbucket/bitbucket.js';

import { basicAuth, postPullRequest } from '../post-pr/post-pr.js';
import {
  extractReworkContent,
  isClancyComment,
  isReworkComment,
} from '../rework-comment/rework-comment.js';

/** Minimal fetch signature for Bitbucket API calls. */
type BbFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Bitbucket Cloud API base. */
const CLOUD_API = 'https://api.bitbucket.org/2.0';

/** Options for {@link createPullRequest}. */
type CreateCloudPrOpts = {
  readonly fetchFn: BbFetch;
  readonly username: string;
  readonly token: string;
  readonly workspace: string;
  readonly repoSlug: string;
  readonly sourceBranch: string;
  readonly targetBranch: string;
  readonly title: string;
  readonly description: string;
};

/** Options for {@link postCloudPrComment}. */
type PostCloudCommentOpts = {
  readonly fetchFn: BbFetch;
  readonly username: string;
  readonly token: string;
  readonly workspace: string;
  readonly repoSlug: string;
  readonly prId: number;
  readonly body: string;
};

/** Options for {@link checkPrReviewState}. */
type CheckCloudOpts = {
  readonly fetchFn: BbFetch;
  readonly username: string;
  readonly token: string;
  readonly workspace: string;
  readonly repoSlug: string;
  readonly branch: string;
  readonly since?: string;
};

/** Options for {@link fetchPrReviewComments}. */
type FetchCloudCommentsOpts = {
  readonly fetchFn: BbFetch;
  readonly username: string;
  readonly token: string;
  readonly workspace: string;
  readonly repoSlug: string;
  readonly prId: number;
  readonly since?: string;
};

/**
 * Create a pull request on Bitbucket Cloud.
 *
 * @param opts - Cloud PR creation options.
 * @returns A result with the PR URL and ID on success, or an error.
 */
export async function createPullRequest(
  opts: CreateCloudPrOpts,
): Promise<PrCreationResult> {
  const { fetchFn, username, token, workspace, repoSlug } = opts;
  const { sourceBranch, targetBranch, title, description } = opts;

  return postPullRequest({
    fetchFn,
    url: `${CLOUD_API}/repositories/${workspace}/${repoSlug}/pullrequests`,
    headers: { Authorization: basicAuth(username, token) },
    body: {
      title,
      description,
      source: { branch: { name: sourceBranch } },
      destination: { branch: { name: targetBranch } },
      close_source_branch: true,
    },
    parseSuccess: (json) => {
      const data = bitbucketPrCreatedSchema.parse(json);
      return { url: data.links?.html?.href ?? '', number: data.id ?? 0 };
    },
    isAlreadyExists: (status, text) =>
      status === 409 && text.includes('already exists'),
  });
}

/**
 * Post a comment on a Bitbucket Cloud pull request.
 *
 * Best-effort — never throws.
 *
 * @param opts - Cloud comment options.
 * @returns `true` on success, `false` on error.
 */
export async function postCloudPrComment(
  opts: PostCloudCommentOpts,
): Promise<boolean> {
  const { fetchFn, username, token, workspace, repoSlug, prId, body } = opts;

  try {
    const res = await fetchFn(
      `${CLOUD_API}/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: basicAuth(username, token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: { raw: body } }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Check the review state of an open PR on Bitbucket Cloud.
 *
 * Inline comments (with `inline` property) always trigger rework.
 * Conversation comments only trigger when prefixed with `Rework:`.
 *
 * @param opts - Cloud review state options.
 * @returns The review state, or `undefined` if no open PR or on error.
 */
export async function checkPrReviewState(
  opts: CheckCloudOpts,
): Promise<PrReviewState | undefined> {
  const { fetchFn, username, token, workspace, repoSlug, branch, since } = opts;
  const auth = basicAuth(username, token);

  try {
    const prRes = await fetchFn(
      `${CLOUD_API}/repositories/${workspace}/${repoSlug}/pullrequests?q=source.branch.name="${branch}"&state=OPEN`,
      { headers: { Authorization: auth } },
    );
    if (!prRes.ok) return undefined;

    const parsed = bitbucketPrListSchema.parse(await prRes.json());
    if (parsed.values.length === 0) return undefined;

    const pr = parsed.values[0]!;
    const comments = await fetchCloudComments({
      fetchFn,
      auth,
      workspace,
      repoSlug,
      prId: pr.id,
    });
    if (!comments) return undefined;

    const relevant = filterBySince(comments, since).filter(
      (c) => !isClancyComment(c.content.raw),
    );
    const hasInline = relevant.some((c) => c.inline != null);
    const hasReworkConvo = relevant.some(
      (c) => c.inline == null && isReworkComment(c.content.raw),
    );

    return {
      changesRequested: hasInline || hasReworkConvo,
      prNumber: pr.id,
      prUrl: pr.links.html?.href ?? '',
    };
  } catch {
    return undefined;
  }
}

/**
 * Fetch feedback comments from a Bitbucket Cloud PR.
 *
 * Inline comments are always included (prefixed with `[path]`).
 * Conversation comments only when prefixed with `Rework:` (prefix stripped).
 *
 * @param opts - Cloud comment fetch options.
 * @returns Array of feedback strings, or `[]` on error.
 */
export async function fetchPrReviewComments(
  opts: FetchCloudCommentsOpts,
): Promise<readonly string[]> {
  const { fetchFn, username, token, workspace, repoSlug, prId, since } = opts;
  const auth = basicAuth(username, token);

  try {
    const comments = await fetchCloudComments({
      fetchFn,
      auth,
      workspace,
      repoSlug,
      prId,
    });
    if (!comments) return [];

    return filterBySince(comments, since)
      .filter((c) => !isClancyComment(c.content.raw))
      .flatMap((c) => formatComment(c));
  } catch {
    return [];
  }
}

// ─── private helpers ────────────────────────────────────────────────────────

/** Options for {@link fetchCloudComments}. */
type FetchCommentsHelperOpts = {
  readonly fetchFn: BbFetch;
  readonly auth: string;
  readonly workspace: string;
  readonly repoSlug: string;
  readonly prId: number;
};

/** Fetch Cloud PR comments. Returns `undefined` on error. */
async function fetchCloudComments(
  opts: FetchCommentsHelperOpts,
): Promise<readonly BitbucketComment[] | undefined> {
  const { fetchFn, auth, workspace, repoSlug, prId } = opts;

  const res = await fetchFn(
    `${CLOUD_API}/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments?pagelen=100`,
    { headers: { Authorization: auth } },
  );
  if (!res.ok) return undefined;

  const parsed = bitbucketCommentsSchema.parse(await res.json());
  return parsed.values;
}

/** Filter comments by since timestamp. */
function filterBySince(
  comments: readonly BitbucketComment[],
  since?: string,
): readonly BitbucketComment[] {
  if (!since) return comments;
  return comments.filter((c) => c.created_on > since);
}

/** Format a comment into a feedback string, or empty if not actionable. */
function formatComment(c: BitbucketComment): readonly string[] {
  if (c.inline != null) {
    const prefix = c.inline.path ? `[${c.inline.path}] ` : '';
    return [`${prefix}${c.content.raw}`];
  }

  if (isReworkComment(c.content.raw)) {
    return [extractReworkContent(c.content.raw)];
  }

  return [];
}
