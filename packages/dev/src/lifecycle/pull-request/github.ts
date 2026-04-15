/**
 * GitHub pull request creation and review state checking.
 *
 * Uses the GitHub REST API to create pull requests, check review state,
 * and fetch review comments.
 * Supports both github.com and GitHub Enterprise (GHE).
 */
import type {
  PrCreationResult,
  PrReviewState,
} from '@chief-clancy/core/types/index.js';

import {
  GITHUB_API,
  githubHeaders,
} from '@chief-clancy/core/board/github/api.js';
import {
  githubCommentsResponseSchema,
  githubPrCommentsSchema,
  githubPrCreatedSchema,
  githubPrListSchema,
  githubReviewListSchema,
} from '@chief-clancy/core/schemas/github.js';

import { postPullRequest } from './post-pr/post-pr.js';
import {
  extractReworkContent,
  isClancyComment,
  isReworkComment,
} from './rework-comment/rework-comment.js';

/** Minimal fetch signature for GitHub API calls. */
type GitHubFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Options for {@link checkPrReviewState}. */
type CheckReviewOpts = {
  readonly fetchFn: GitHubFetch;
  readonly token: string;
  readonly repo: string;
  readonly branch: string;
  readonly owner: string;
  readonly apiBase?: string;
  readonly since?: string;
};

/** Options for {@link fetchPrReviewComments}. */
type FetchCommentsOpts = {
  readonly fetchFn: GitHubFetch;
  readonly token: string;
  readonly repo: string;
  readonly prNumber: number;
  readonly apiBase?: string;
  readonly since?: string;
};

/** Options for {@link postPrComment}. */
type PostCommentOpts = {
  readonly fetchFn: GitHubFetch;
  readonly token: string;
  readonly repo: string;
  readonly prNumber: number;
  readonly body: string;
  readonly apiBase?: string;
};

/** Options for {@link requestReview}. */
type RequestReviewOpts = {
  readonly fetchFn: GitHubFetch;
  readonly token: string;
  readonly repo: string;
  readonly prNumber: number;
  readonly reviewers: readonly string[];
  readonly apiBase?: string;
};

/** Options for {@link createPullRequest}. */
type CreatePrOpts = {
  readonly fetchFn: GitHubFetch;
  readonly token: string;
  readonly repo: string;
  readonly head: string;
  readonly base: string;
  readonly title: string;
  readonly body: string;
  readonly apiBase?: string;
};

// ─── exported functions ─────────────────────────────────────────────────────

/**
 * Check the review state of an open PR for a given branch.
 *
 * Finds the open PR matching the branch, fetches inline and conversation
 * comments. Any inline comment triggers rework. Conversation comments
 * only trigger rework when prefixed with `Rework:`.
 *
 * @param opts - Options including fetch, token, repo, branch, and owner.
 * @returns The review state, or `undefined` if no open PR or on error.
 */
export async function checkPrReviewState(
  opts: CheckReviewOpts,
): Promise<PrReviewState | undefined> {
  const { fetchFn, token, repo, branch, owner } = opts;
  const apiBase = opts.apiBase ?? GITHUB_API;

  try {
    const pr = await findOpenPr({
      fetchFn,
      apiBase,
      repo,
      owner,
      branch,
      token,
    });
    if (!pr) return undefined;

    const { inline, convo } = await fetchFilteredComments({
      fetchFn,
      apiBase,
      repo,
      prNumber: pr.number,
      token,
      since: opts.since,
    });

    const hasInlineComments = inline.length > 0;
    const hasReworkConvo = convo.some(
      (c) => c.body != null && isReworkComment(c.body),
    );
    const commentTriggered = hasInlineComments || hasReworkConvo;

    if (commentTriggered) {
      return { changesRequested: true, prNumber: pr.number, prUrl: pr.url };
    }

    const reviewResult = await checkReviews({
      fetchFn,
      apiBase,
      repo,
      prNumber: pr.number,
      token,
    });

    return {
      changesRequested: reviewResult.changesRequested,
      prNumber: pr.number,
      prUrl: pr.url,
      ...(reviewResult.reviewers && { reviewers: reviewResult.reviewers }),
    };
  } catch {
    return undefined;
  }
}

/**
 * Fetch feedback comments (inline + conversation) for a PR.
 *
 * Inline comments are included unconditionally. Conversation comments
 * are only included when prefixed with `Rework:` (case-insensitive),
 * with the prefix stripped. Comments prefixed with `[clancy]` are excluded.
 *
 * @param opts - Options including fetch, token, repo, and prNumber.
 * @returns An array of feedback descriptions, or `[]` on error.
 */
export async function fetchPrReviewComments(
  opts: FetchCommentsOpts,
): Promise<readonly string[]> {
  const { fetchFn, token, repo, prNumber } = opts;
  const apiBase = opts.apiBase ?? GITHUB_API;

  try {
    const { inline, convo } = await fetchFilteredComments({
      fetchFn,
      apiBase,
      repo,
      prNumber,
      token,
      since: opts.since,
    });

    const inlineLines = inline
      .filter((c) => c.body != null)
      .map((c) => {
        const prefix = c.path ? `[${c.path}] ` : '';
        return `${prefix}${c.body}`;
      });

    const convoLines = convo
      .filter((c) => c.body != null && isReworkComment(c.body))
      .map((c) => extractReworkContent(c.body!));

    return [...inlineLines, ...convoLines];
  } catch {
    return [];
  }
}

/**
 * Post a comment on a GitHub PR/issue.
 *
 * Best-effort — never throws. Returns `true` on success, `false` on error.
 *
 * @param opts - Options including fetch, token, repo, prNumber, and body.
 * @returns `true` on success, `false` on error.
 */
export async function postPrComment(opts: PostCommentOpts): Promise<boolean> {
  const { fetchFn, token, repo, prNumber, body } = opts;
  const apiBase = opts.apiBase ?? GITHUB_API;

  try {
    const res = await fetchFn(
      `${apiBase}/repos/${repo}/issues/${prNumber}/comments`,
      {
        method: 'POST',
        headers: {
          ...githubHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Re-request review from specified reviewers on a GitHub PR.
 *
 * Best-effort — never throws. Returns `true` on success, `false` on error.
 *
 * @param opts - Options including fetch, token, repo, prNumber, and reviewers.
 * @returns `true` on success, `false` on error.
 */
export async function requestReview(opts: RequestReviewOpts): Promise<boolean> {
  const { fetchFn, token, repo, prNumber, reviewers } = opts;
  const apiBase = opts.apiBase ?? GITHUB_API;

  try {
    const res = await fetchFn(
      `${apiBase}/repos/${repo}/pulls/${prNumber}/requested_reviewers`,
      {
        method: 'POST',
        headers: {
          ...githubHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reviewers }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Create a pull request on GitHub.
 *
 * @param opts - Options including fetch, token, repo, head, base, title, and body.
 * @returns A result with the PR URL and number on success, or an error.
 */
export async function createPullRequest(
  opts: CreatePrOpts,
): Promise<PrCreationResult> {
  const { fetchFn, token, repo, head, base, title, body } = opts;
  const apiBase = opts.apiBase ?? GITHUB_API;

  return postPullRequest({
    fetchFn,
    url: `${apiBase}/repos/${repo}/pulls`,
    headers: githubHeaders(token),
    body: { title, head, base, body },
    parseSuccess: (json) => {
      const data = githubPrCreatedSchema.parse(json);
      return { url: data.html_url ?? '', number: data.number ?? 0 };
    },
    isAlreadyExists: (status, text) =>
      status === 422 && text.includes('already exists'),
  });
}

// ─── private helpers ────────────────────────────────────────────────────────

/** Minimal PR info needed from the list endpoint. */
type OpenPr = { readonly number: number; readonly url: string };

/** Options for {@link findOpenPr}. */
type FindOpenPrOpts = {
  readonly fetchFn: GitHubFetch;
  readonly apiBase: string;
  readonly repo: string;
  readonly owner: string;
  readonly branch: string;
  readonly token: string;
};

/** Find the first open PR for a branch. */
async function findOpenPr(opts: FindOpenPrOpts): Promise<OpenPr | undefined> {
  const { fetchFn, apiBase, repo, owner, branch, token } = opts;

  const res = await fetchFn(
    `${apiBase}/repos/${repo}/pulls?head=${encodeURIComponent(`${owner}:${branch}`)}&state=open`,
    { headers: githubHeaders(token) },
  );
  if (!res.ok) return undefined;

  const prs = githubPrListSchema.parse(await res.json());
  if (prs.length === 0) return undefined;

  const pr = prs[0];
  return { number: pr.number, url: pr.html_url };
}

/** Filtered inline and conversation comments for a PR. */
type FilteredComments = {
  readonly inline: readonly {
    readonly body?: string | null;
    readonly path?: string;
  }[];
  readonly convo: readonly { readonly body?: string | null }[];
};

/** Options for {@link fetchFilteredComments}. */
type FetchFilteredOpts = {
  readonly fetchFn: GitHubFetch;
  readonly apiBase: string;
  readonly repo: string;
  readonly prNumber: number;
  readonly token: string;
  readonly since?: string;
};

/** Fetch inline + conversation comments, filtering out [clancy] comments. */
async function fetchFilteredComments(
  opts: FetchFilteredOpts,
): Promise<FilteredComments> {
  const { fetchFn, apiBase, repo, prNumber, token, since } = opts;
  const headers = githubHeaders(token);
  const sinceParam = since ? `&since=${encodeURIComponent(since)}` : '';

  const [inlineRes, convoRes] = await Promise.all([
    fetchFn(
      `${apiBase}/repos/${repo}/pulls/${prNumber}/comments?per_page=100${sinceParam}`,
      { headers },
    ),
    fetchFn(
      `${apiBase}/repos/${repo}/issues/${prNumber}/comments?per_page=100${sinceParam}`,
      { headers },
    ),
  ]);

  if (!inlineRes.ok || !convoRes.ok) {
    return { inline: [], convo: [] };
  }

  const rawInline = githubPrCommentsSchema.parse(await inlineRes.json());
  const rawConvo = githubCommentsResponseSchema.parse(await convoRes.json());

  return {
    inline: rawInline.filter((c) => !c.body || !isClancyComment(c.body)),
    convo: rawConvo.filter((c) => !c.body || !isClancyComment(c.body)),
  };
}

/** Review check result from GitHub reviews API. */
type ReviewCheckResult = {
  readonly changesRequested: boolean;
  readonly reviewers?: readonly string[];
};

/** Options for {@link checkReviews}. */
type CheckReviewsOpts = {
  readonly fetchFn: GitHubFetch;
  readonly apiBase: string;
  readonly repo: string;
  readonly prNumber: number;
  readonly token: string;
};

/** Check GitHub reviews for CHANGES_REQUESTED state. Best-effort. */
async function checkReviews(
  opts: CheckReviewsOpts,
): Promise<ReviewCheckResult> {
  const { fetchFn, apiBase, repo, prNumber, token } = opts;

  try {
    const res = await fetchFn(
      `${apiBase}/repos/${repo}/pulls/${prNumber}/reviews?per_page=100`,
      { headers: githubHeaders(token) },
    );

    if (!res.ok) return { changesRequested: false };

    const reviews = githubReviewListSchema.parse(await res.json());
    const latestByUser = new Map(
      reviews
        .filter((r) => r.state !== 'PENDING' && r.state !== 'DISMISSED')
        .map((r) => [r.user.login, r.state] as const),
    );

    const requested = [...latestByUser.entries()]
      .filter(([, state]) => state === 'CHANGES_REQUESTED')
      .map(([login]) => login);

    if (requested.length === 0) return { changesRequested: false };
    return { changesRequested: true, reviewers: requested };
  } catch {
    return { changesRequested: false };
  }
}
