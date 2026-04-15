/**
 * GitLab merge request creation and review state checking.
 *
 * Uses the GitLab REST API v4 to create merge requests, check review state,
 * and fetch review comments.
 * Supports both gitlab.com and self-hosted instances.
 *
 * Auth: `PRIVATE-TOKEN` header (personal access token with `api` scope).
 */
import type {
  GitLabDiscussion,
  GitLabNote,
} from '@chief-clancy/core/schemas/gitlab.js';
import type {
  PrCreationResult,
  PrReviewState,
} from '@chief-clancy/core/types/index.js';

import {
  gitlabDiscussionsSchema,
  gitlabMrCreatedSchema,
  gitlabMrListSchema,
} from '@chief-clancy/core/schemas/gitlab.js';

import { postPullRequest } from './post-pr/post-pr.js';
import {
  extractReworkContent,
  isClancyComment,
  isReworkComment,
} from './rework-comment/rework-comment.js';

/** Minimal fetch signature for GitLab API calls. */
type GitLabFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Options for {@link createMergeRequest}. */
type CreateMrOpts = {
  readonly fetchFn: GitLabFetch;
  readonly token: string;
  readonly apiBase: string;
  readonly projectPath: string;
  readonly sourceBranch: string;
  readonly targetBranch: string;
  readonly title: string;
  readonly description: string;
};

/** Options for {@link postMrNote}. */
type PostNoteOpts = {
  readonly fetchFn: GitLabFetch;
  readonly token: string;
  readonly apiBase: string;
  readonly projectPath: string;
  readonly mrIid: number;
  readonly body: string;
};

/** Options for {@link resolveDiscussions}. */
type ResolveOpts = {
  readonly fetchFn: GitLabFetch;
  readonly token: string;
  readonly apiBase: string;
  readonly projectPath: string;
  readonly mrIid: number;
  readonly discussionIds: readonly string[];
};

/** Options for {@link checkMrReviewState}. */
type CheckMrOpts = {
  readonly fetchFn: GitLabFetch;
  readonly token: string;
  readonly apiBase: string;
  readonly projectPath: string;
  readonly branch: string;
  readonly since?: string;
};

/** Options for {@link fetchMrReviewComments}. */
type FetchMrCommentsOpts = {
  readonly fetchFn: GitLabFetch;
  readonly token: string;
  readonly apiBase: string;
  readonly projectPath: string;
  readonly mrIid: number;
  readonly since?: string;
};

// ─── exported functions ─────────────────────────────────────────────────────

/**
 * Create a merge request on GitLab.
 *
 * @param opts - Options including fetch, token, apiBase, projectPath, branches, title, and description.
 * @returns A result with the MR URL and IID on success, or an error.
 */
export async function createMergeRequest(
  opts: CreateMrOpts,
): Promise<PrCreationResult> {
  const { fetchFn, token, apiBase, projectPath } = opts;
  const { sourceBranch, targetBranch, title, description } = opts;
  const encoded = encodeURIComponent(projectPath);

  return postPullRequest({
    fetchFn,
    url: `${apiBase}/projects/${encoded}/merge_requests`,
    headers: { 'PRIVATE-TOKEN': token },
    body: {
      source_branch: sourceBranch,
      target_branch: targetBranch,
      title,
      description,
      remove_source_branch: true,
    },
    parseSuccess: (json) => {
      const data = gitlabMrCreatedSchema.parse(json);
      return { url: data.web_url ?? '', number: data.iid ?? 0 };
    },
    isAlreadyExists: (status, text) =>
      status === 409 && text.includes('already exists'),
  });
}

/**
 * Post a note (comment) on a GitLab merge request.
 *
 * Best-effort — never throws.
 *
 * @param opts - Options including fetch, token, apiBase, projectPath, mrIid, and body.
 * @returns `true` on success, `false` on error.
 */
export async function postMrNote(opts: PostNoteOpts): Promise<boolean> {
  const { fetchFn, token, apiBase, projectPath, mrIid, body } = opts;

  try {
    const encoded = encodeURIComponent(projectPath);
    const res = await fetchFn(
      `${apiBase}/projects/${encoded}/merge_requests/${mrIid}/notes`,
      {
        method: 'POST',
        headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve MR discussion threads on GitLab.
 *
 * Best-effort per discussion — failures are silently skipped.
 *
 * @param opts - Options including fetch, token, apiBase, projectPath, mrIid, and discussionIds.
 * @returns The number of successfully resolved discussions.
 */
export async function resolveDiscussions(opts: ResolveOpts): Promise<number> {
  const { fetchFn, token, apiBase, projectPath, mrIid, discussionIds } = opts;
  const encoded = encodeURIComponent(projectPath);

  const results = await Promise.allSettled(
    discussionIds.map((id) =>
      fetchFn(
        `${apiBase}/projects/${encoded}/merge_requests/${mrIid}/discussions/${id}`,
        {
          method: 'PUT',
          headers: {
            'PRIVATE-TOKEN': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ resolved: true }),
        },
      ).then((res) => res.ok),
    ),
  );

  return results.filter((r) => r.status === 'fulfilled' && r.value === true)
    .length;
}

/**
 * Check the review state of an open MR for a given branch.
 *
 * Finds the open MR, fetches discussions. Inline notes (DiffNote)
 * always trigger rework. Conversation notes only trigger when prefixed
 * with `Rework:`. Does not check formal approval state — only GitHub
 * checks formal reviews (CHANGES_REQUESTED) via the reviews API.
 *
 * @param opts - Options including fetch, token, apiBase, projectPath, branch, and since.
 * @returns The review state, or `undefined` if no open MR or on error.
 */
export async function checkMrReviewState(
  opts: CheckMrOpts,
): Promise<PrReviewState | undefined> {
  const { fetchFn, token, apiBase, projectPath, branch, since } = opts;

  try {
    const mr = await findOpenMr({
      fetchFn,
      token,
      apiBase,
      projectPath,
      branch,
    });
    if (!mr) return undefined;

    const discussions = await fetchDiscussions({
      fetchFn,
      token,
      apiBase,
      projectPath,
      mrIid: mr.iid,
    });
    if (!discussions) return undefined;

    const hasRework = discussions.some((d) =>
      d.notes.some((n) => isActionableNote(n, since)),
    );

    return { changesRequested: hasRework, prNumber: mr.iid, prUrl: mr.url };
  } catch {
    return undefined;
  }
}

/**
 * Fetch feedback comments from an MR's discussions.
 *
 * Inline notes (DiffNote) are always included. Conversation notes are
 * only included when prefixed with `Rework:` (case-insensitive), with
 * the prefix stripped. Returns discussion IDs for later resolution.
 *
 * @param opts - Options including fetch, token, apiBase, projectPath, mrIid, and since.
 * @returns Feedback descriptions and discussion IDs, or empty on error.
 */
export async function fetchMrReviewComments(
  opts: FetchMrCommentsOpts,
): Promise<{
  readonly comments: readonly string[];
  readonly discussionIds: readonly string[];
}> {
  const { fetchFn, token, apiBase, projectPath, mrIid, since } = opts;

  try {
    const discussions = await fetchDiscussions({
      fetchFn,
      token,
      apiBase,
      projectPath,
      mrIid,
    });
    if (!discussions) return { comments: [], discussionIds: [] };

    return extractFeedback(discussions, since);
  } catch {
    return { comments: [], discussionIds: [] };
  }
}

// ─── private helpers ────────────────────────────────────────────────────────

/** Minimal MR info from the list endpoint. */
type OpenMr = { readonly iid: number; readonly url: string };

/** Options for {@link findOpenMr}. */
type FindMrOpts = {
  readonly fetchFn: GitLabFetch;
  readonly token: string;
  readonly apiBase: string;
  readonly projectPath: string;
  readonly branch: string;
};

/** Find the first open MR for a branch. */
async function findOpenMr(opts: FindMrOpts): Promise<OpenMr | undefined> {
  const { fetchFn, token, apiBase, projectPath, branch } = opts;
  const encoded = encodeURIComponent(projectPath);

  const res = await fetchFn(
    `${apiBase}/projects/${encoded}/merge_requests?source_branch=${encodeURIComponent(branch)}&state=opened`,
    { headers: { 'PRIVATE-TOKEN': token } },
  );

  if (!res.ok) return undefined;

  const data = gitlabMrListSchema.parse(await res.json());
  if (data.length === 0) return undefined;

  const mr = data[0];
  return { iid: mr.iid, url: mr.web_url };
}

/** Options for {@link fetchDiscussions}. */
type FetchDiscOpts = {
  readonly fetchFn: GitLabFetch;
  readonly token: string;
  readonly apiBase: string;
  readonly projectPath: string;
  readonly mrIid: number;
};

/** Fetch all discussions for an MR. Returns `undefined` on error. */
async function fetchDiscussions(
  opts: FetchDiscOpts,
): Promise<readonly GitLabDiscussion[] | undefined> {
  const { fetchFn, token, apiBase, projectPath, mrIid } = opts;
  const encoded = encodeURIComponent(projectPath);

  const res = await fetchFn(
    `${apiBase}/projects/${encoded}/merge_requests/${mrIid}/discussions?per_page=100`,
    { headers: { 'PRIVATE-TOKEN': token } },
  );

  if (!res.ok) return undefined;
  return gitlabDiscussionsSchema.parse(await res.json());
}

/** Check if a note is an unresolved DiffNote or a Rework: comment. */
function isActionableNote(note: GitLabNote, since?: string): boolean {
  if (note.system) return false;
  if (isClancyComment(note.body)) return false;
  if (since && note.created_at && note.created_at <= since) return false;

  const isUnresolvedDiff =
    note.type === 'DiffNote' &&
    note.resolvable !== false &&
    note.resolved !== true;

  return isUnresolvedDiff || isReworkComment(note.body);
}

/** Extract feedback comments and discussion IDs from discussions. */
function extractFeedback(
  discussions: readonly GitLabDiscussion[],
  since?: string,
): {
  readonly comments: readonly string[];
  readonly discussionIds: readonly string[];
} {
  const pairs = discussions.map((d) => {
    const relevantNotes = d.notes
      .filter((n) => !n.system && !isClancyComment(n.body))
      .filter((n) => !since || !n.created_at || n.created_at > since);

    const feedback = relevantNotes
      .flatMap((n) => formatNote(n))
      .filter((s) => s !== undefined);

    const discussionId = feedback.length > 0 && d.id != null ? d.id : undefined;
    return { feedback, discussionId };
  });

  return {
    comments: pairs.flatMap((p) => p.feedback),
    discussionIds: pairs
      .map((p) => p.discussionId)
      .filter((id): id is string => id != null),
  };
}

/** Format a single note into a feedback string, or empty array if not actionable. */
function formatNote(note: GitLabNote): readonly string[] {
  const isUnresolvedDiff =
    note.type === 'DiffNote' &&
    note.resolvable !== false &&
    note.resolved !== true;

  if (isUnresolvedDiff) {
    const prefix = note.position?.new_path
      ? `[${note.position.new_path}] `
      : '';
    return [`${prefix}${note.body}`];
  }

  if (isReworkComment(note.body)) {
    return [extractReworkContent(note.body)];
  }

  return [];
}
