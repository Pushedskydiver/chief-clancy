/**
 * Azure DevOps pull request operations.
 *
 * Auth: PAT via HTTP Basic Auth (empty username, PAT as password).
 */
import type { AzdoThread } from '~/c/schemas/azdo/azdo-pr.js';
import type { PrCreationResult, PrReviewState } from '~/c/types/index.js';

import {
  azdoPrCreatedSchema,
  azdoPrListSchema,
  azdoThreadListSchema,
} from '~/c/schemas/azdo/azdo-pr.js';

import { basicAuth, postPullRequest } from '../post-pr/post-pr.js';
import {
  extractReworkContent,
  isClancyComment,
  isReworkComment,
} from '../rework-comment/rework-comment.js';

/** Minimal fetch signature for Azure DevOps API calls. */
type AzdoFetch = (url: string, init: RequestInit) => Promise<Response>;

/** API version query parameter appended to all requests. */
const API_VERSION = 'api-version=7.1';

/** Azure DevOps API base URL. */
const AZDO_API = 'https://dev.azure.com';

/** Options for {@link createPullRequest}. */
type CreatePrOpts = {
  readonly fetchFn: AzdoFetch;
  readonly org: string;
  readonly project: string;
  readonly repo: string;
  readonly pat: string;
  readonly sourceBranch: string;
  readonly targetBranch: string;
  readonly title: string;
  readonly description: string;
};

/** Options for {@link postPrComment}. */
type PostCommentOpts = {
  readonly fetchFn: AzdoFetch;
  readonly org: string;
  readonly project: string;
  readonly repo: string;
  readonly pat: string;
  readonly prId: number;
  readonly body: string;
};

/** Options for {@link checkPrReviewState}. */
type CheckReviewOpts = {
  readonly fetchFn: AzdoFetch;
  readonly org: string;
  readonly project: string;
  readonly repo: string;
  readonly pat: string;
  readonly branch: string;
  readonly since?: string;
};

/** Options for {@link fetchPrReviewComments}. */
type FetchCommentsOpts = {
  readonly fetchFn: AzdoFetch;
  readonly org: string;
  readonly project: string;
  readonly repo: string;
  readonly pat: string;
  readonly prId: number;
  readonly since?: string;
};

/**
 * Create a pull request on Azure DevOps.
 *
 * @param opts - AzDO PR creation options.
 * @returns A result with the PR URL and ID on success, or an error.
 */
export async function createPullRequest(
  opts: CreatePrOpts,
): Promise<PrCreationResult> {
  const { fetchFn, org, project, repo, pat } = opts;
  const { sourceBranch, targetBranch, title, description } = opts;

  return postPullRequest({
    fetchFn,
    url: `${AZDO_API}/${org}/${project}/_apis/git/repositories/${repo}/pullrequests?${API_VERSION}`,
    headers: { Authorization: basicAuth('', pat) },
    body: {
      sourceRefName: `refs/heads/${sourceBranch}`,
      targetRefName: `refs/heads/${targetBranch}`,
      title,
      description,
    },
    parseSuccess: (json) => {
      const data = azdoPrCreatedSchema.parse(json);
      const prId = data.pullRequestId ?? 0;
      return {
        url: `${AZDO_API}/${org}/${project}/_git/${repo}/pullrequest/${prId}`,
        number: prId,
      };
    },
    isAlreadyExists: (status, text) =>
      status === 409 ||
      (status === 400 && text.includes('already has an active pull request')),
  });
}

/**
 * Post a comment thread on an Azure DevOps pull request.
 *
 * Best-effort — never throws.
 *
 * @param opts - AzDO comment options.
 * @returns `true` on success, `false` on error.
 */
export async function postPrComment(opts: PostCommentOpts): Promise<boolean> {
  const { fetchFn, org, project, repo, pat, prId, body } = opts;

  try {
    const base = prBaseUrl(org, project, repo);
    const res = await fetchFn(`${base}/${prId}/threads?${API_VERSION}`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth('', pat),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comments: [{ parentCommentId: 0, content: body, commentType: 1 }],
        status: 1,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Check the review state of an open PR on Azure DevOps.
 *
 * Inline threads (with `threadContext`) always trigger rework.
 * General threads only trigger when the first comment is prefixed with `Rework:`.
 * System threads and deleted threads are excluded.
 *
 * @param opts - AzDO review state options.
 * @returns The review state, or `undefined` if no open PR or on error.
 */
export async function checkPrReviewState(
  opts: CheckReviewOpts,
): Promise<PrReviewState | undefined> {
  const { fetchFn, org, project, repo, pat, branch, since } = opts;
  const auth = basicAuth('', pat);

  try {
    const base = prBaseUrl(org, project, repo);
    const prRes = await fetchFn(
      `${base}?searchCriteria.sourceRefName=${encodeURIComponent(`refs/heads/${branch}`)}&searchCriteria.status=active&${API_VERSION}`,
      { headers: { Authorization: auth } },
    );
    if (!prRes.ok) return undefined;

    const parsed = azdoPrListSchema.parse(await prRes.json());
    if (parsed.value.length === 0) return undefined;

    const pr = parsed.value[0]!;
    const threads = await fetchThreads({
      fetchFn,
      auth,
      org,
      project,
      repo,
      prId: pr.pullRequestId,
    });
    if (!threads) return undefined;

    const relevant = filterBySince(activeThreads(threads), since);
    const hasInline = relevant.some((t) => t.threadContext != null);
    const hasReworkConvo = relevant.some(
      (t) =>
        t.threadContext == null &&
        t.comments.length > 0 &&
        isReworkComment(t.comments[0]!.content ?? ''),
    );

    return {
      changesRequested: hasInline || hasReworkConvo,
      prNumber: pr.pullRequestId,
      prUrl: `${AZDO_API}/${org}/${project}/_git/${repo}/pullrequest/${pr.pullRequestId}`,
    };
  } catch {
    return undefined;
  }
}

/**
 * Fetch feedback comments from an Azure DevOps PR.
 *
 * Inline threads are always included (prefixed with `[filePath]`).
 * General threads only when the first comment is prefixed with `Rework:` (prefix stripped).
 * System threads and deleted threads are excluded.
 *
 * @param opts - AzDO comment fetch options.
 * @returns Array of feedback strings, or `[]` on error.
 */
export async function fetchPrReviewComments(
  opts: FetchCommentsOpts,
): Promise<readonly string[]> {
  const { fetchFn, org, project, repo, pat, prId, since } = opts;
  const auth = basicAuth('', pat);

  try {
    const threads = await fetchThreads({
      fetchFn,
      auth,
      org,
      project,
      repo,
      prId,
    });
    if (!threads) return [];

    return filterBySince(activeThreads(threads), since).flatMap((t) =>
      formatThread(t),
    );
  } catch {
    return [];
  }
}

// ─── private helpers ────────────────────────────────────────────────────────

/** Build the pull requests API base URL. */
function prBaseUrl(org: string, project: string, repo: string): string {
  return `${AZDO_API}/${org}/${project}/_apis/git/repositories/${repo}/pullrequests`;
}

/** Options for {@link fetchThreads}. */
type FetchThreadsOpts = {
  readonly fetchFn: AzdoFetch;
  readonly auth: string;
  readonly org: string;
  readonly project: string;
  readonly repo: string;
  readonly prId: number;
};

/** Fetch PR threads. Returns `undefined` on error. */
async function fetchThreads(
  opts: FetchThreadsOpts,
): Promise<readonly AzdoThread[] | undefined> {
  const { fetchFn, auth, org, project, repo, prId } = opts;
  const base = prBaseUrl(org, project, repo);

  const res = await fetchFn(`${base}/${prId}/threads?${API_VERSION}`, {
    headers: { Authorization: auth },
  });
  if (!res.ok) return undefined;

  const parsed = azdoThreadListSchema.parse(await res.json());
  return parsed.value;
}

/** Filter out deleted threads, system comments, and Clancy automation comments. */
function activeThreads(threads: readonly AzdoThread[]): readonly AzdoThread[] {
  return threads.filter(
    (t) =>
      t.isDeleted !== true &&
      t.comments.length > 0 &&
      t.comments[0]!.commentType !== 'system' &&
      !isClancyComment(t.comments[0]!.content ?? ''),
  );
}

/** Filter threads by since timestamp (ISO 8601 string comparison). */
function filterBySince(
  threads: readonly AzdoThread[],
  since?: string,
): readonly AzdoThread[] {
  if (!since) return threads;
  return threads.filter((t) => (t.publishedDate ?? '') > since);
}

/** Format a thread into a feedback string, or empty if not actionable. */
function formatThread(t: AzdoThread): readonly string[] {
  const content = t.comments[0]?.content ?? '';
  if (!content) return [];

  if (t.threadContext != null) {
    const prefix = t.threadContext.filePath
      ? `[${t.threadContext.filePath}] `
      : '';
    return [`${prefix}${content}`];
  }

  if (isReworkComment(content)) {
    return [extractReworkContent(content)];
  }

  return [];
}
