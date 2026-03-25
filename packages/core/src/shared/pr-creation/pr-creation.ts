/**
 * Platform-dispatched PR/MR creation.
 *
 * Single entry point that resolves credentials, detects platform, and
 * delegates to the appropriate platform-specific creation function.
 * Also provides {@link buildManualPrUrl} for fallback URLs.
 */
import type { SharedEnv } from '~/c/schemas/env/env.js';
import type {
  AzdoRemote,
  BitbucketRemote,
  BitbucketServerRemote,
  GitHubRemote,
  GitLabRemote,
  PrCreationResult,
  RemoteInfo,
} from '~/c/types/remote.js';

import { resolveGitToken } from '~/c/shared/git-token/index.js';
import { createPullRequest as createAzdoPr } from '~/c/shared/pull-request/azdo/index.js';
import {
  createPullRequest as createBbCloudPr,
  createServerPullRequest as createBbServerPr,
} from '~/c/shared/pull-request/bitbucket/index.js';
import { createPullRequest as createGitHubPr } from '~/c/shared/pull-request/github/index.js';
import { createMergeRequest as createGitLabMr } from '~/c/shared/pull-request/gitlab/index.js';
import { buildApiBaseUrl } from '~/c/shared/remote/index.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Minimal fetch signature for platform API calls. */
export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

/** Options for {@link attemptPrCreation}. */
type AttemptPrOpts = {
  readonly fetchFn: FetchFn;
  readonly env: SharedEnv;
  readonly remote: RemoteInfo;
  readonly sourceBranch: string;
  readonly targetBranch: string;
  readonly title: string;
  readonly body: string;
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Attempt to create a PR/MR on the detected remote platform.
 *
 * Resolves credentials and API base URL, then dispatches to the
 * platform-specific creation function. Returns `undefined` if
 * credentials are missing, the platform has no API base, or the
 * remote is unsupported.
 *
 * @param opts - PR creation options with DI dependencies.
 * @returns The PR creation result, or `undefined` if not attempted.
 */
export async function attemptPrCreation(
  opts: AttemptPrOpts,
): Promise<PrCreationResult | undefined> {
  const { env, remote } = opts;

  const creds = resolveGitToken(env, remote);
  if (!creds) return undefined;

  const apiBase = buildApiBaseUrl(remote, env.CLANCY_GIT_API_URL);
  if (!apiBase) return undefined;

  const ctx: DispatchCtx = {
    fetchFn: opts.fetchFn,
    creds,
    apiBase,
    branch: opts,
  };

  switch (remote.host) {
    case 'github':
      return dispatchGitHub(ctx, remote);
    case 'gitlab':
      return dispatchGitLab(ctx, remote);
    case 'bitbucket':
      return dispatchBbCloud(ctx, remote);
    case 'bitbucket-server':
      return dispatchBbServer(ctx, remote);
    case 'azure':
      return dispatchAzdo(ctx, remote);
    default:
      return undefined;
  }
}

/**
 * Build a manual PR/MR creation URL for the user to click.
 *
 * Generates a pre-filled URL for the platform's web UI. Returns
 * `undefined` for platforms without a known URL pattern (unknown, none).
 *
 * @param remote - The detected remote info.
 * @param sourceBranch - The source branch name.
 * @param targetBranch - The target branch name.
 * @returns The manual URL, or `undefined`.
 */
export function buildManualPrUrl(
  remote: RemoteInfo,
  sourceBranch: string,
  targetBranch: string,
): string | undefined {
  const src = encodeURIComponent(sourceBranch);
  const tgt = encodeURIComponent(targetBranch);

  switch (remote.host) {
    case 'github':
      return `https://${remote.hostname}/${remote.owner}/${remote.repo}/compare/${tgt}...${src}`;
    case 'gitlab':
      return `https://${remote.hostname}/${remote.projectPath}/-/merge_requests/new?merge_request[source_branch]=${src}&merge_request[target_branch]=${tgt}`;
    case 'bitbucket':
      return `https://${remote.hostname}/${remote.workspace}/${remote.repoSlug}/pull-requests/new?source=${src}&dest=${tgt}`;
    case 'bitbucket-server':
      return `https://${remote.hostname}/projects/${remote.projectKey}/repos/${remote.repoSlug}/pull-requests?create&sourceBranch=refs/heads/${src}&targetBranch=refs/heads/${tgt}`;
    case 'azure':
      return `https://${remote.hostname}/${remote.org}/${remote.project}/_git/${remote.repo}/pullrequestcreate?sourceRef=${src}&targetRef=${tgt}`;
    default:
      return undefined;
  }
}

// ─── Platform dispatchers ────────────────────────────────────────────────────

/** Shared context built once in {@link attemptPrCreation}. */
type DispatchCtx = {
  readonly fetchFn: FetchFn;
  readonly creds: { readonly token: string; readonly username?: string };
  readonly apiBase: string;
  readonly branch: Pick<
    AttemptPrOpts,
    'sourceBranch' | 'targetBranch' | 'title' | 'body'
  >;
};

function dispatchGitHub(
  ctx: DispatchCtx,
  remote: GitHubRemote,
): Promise<PrCreationResult> {
  return createGitHubPr({
    fetchFn: ctx.fetchFn,
    token: ctx.creds.token,
    repo: `${remote.owner}/${remote.repo}`,
    head: ctx.branch.sourceBranch,
    base: ctx.branch.targetBranch,
    title: ctx.branch.title,
    body: ctx.branch.body,
    apiBase: ctx.apiBase,
  });
}

function dispatchGitLab(
  ctx: DispatchCtx,
  remote: GitLabRemote,
): Promise<PrCreationResult> {
  return createGitLabMr({
    fetchFn: ctx.fetchFn,
    token: ctx.creds.token,
    apiBase: ctx.apiBase,
    projectPath: remote.projectPath,
    sourceBranch: ctx.branch.sourceBranch,
    targetBranch: ctx.branch.targetBranch,
    title: ctx.branch.title,
    description: ctx.branch.body,
  });
}

function dispatchBbCloud(
  ctx: DispatchCtx,
  remote: BitbucketRemote,
): Promise<PrCreationResult> {
  // Safe: resolveGitToken always sets username for Bitbucket Cloud
  return createBbCloudPr({
    fetchFn: ctx.fetchFn,
    username: ctx.creds.username!,
    token: ctx.creds.token,
    workspace: remote.workspace,
    repoSlug: remote.repoSlug,
    sourceBranch: ctx.branch.sourceBranch,
    targetBranch: ctx.branch.targetBranch,
    title: ctx.branch.title,
    description: ctx.branch.body,
  });
}

function dispatchBbServer(
  ctx: DispatchCtx,
  remote: BitbucketServerRemote,
): Promise<PrCreationResult> {
  return createBbServerPr({
    fetchFn: ctx.fetchFn,
    token: ctx.creds.token,
    apiBase: ctx.apiBase,
    projectKey: remote.projectKey,
    repoSlug: remote.repoSlug,
    sourceBranch: ctx.branch.sourceBranch,
    targetBranch: ctx.branch.targetBranch,
    title: ctx.branch.title,
    description: ctx.branch.body,
  });
}

function dispatchAzdo(
  ctx: DispatchCtx,
  remote: AzdoRemote,
): Promise<PrCreationResult> {
  return createAzdoPr({
    fetchFn: ctx.fetchFn,
    org: remote.org,
    project: remote.project,
    repo: remote.repo,
    pat: ctx.creds.token,
    sourceBranch: ctx.branch.sourceBranch,
    targetBranch: ctx.branch.targetBranch,
    title: ctx.branch.title,
    description: ctx.branch.body,
  });
}
