/**
 * Platform-specific rework handlers.
 *
 * Single factory function that resolves the platform once, returning a
 * handler object with uniform method signatures. Eliminates switch
 * duplication — callers use `handlers.checkReviewState(...)` instead
 * of switching on `remote.host`.
 */
import type { PlatformReworkHandlers, ReworkCtx } from './rework-types.js';
import type { SharedEnv } from '@chief-clancy/core/schemas/env.js';
import type { RemoteInfo } from '@chief-clancy/core/types/remote.js';
import type { FetchFn } from '~/d/lifecycle/pr-creation.js';

import { resolveGitToken } from '@chief-clancy/core/shared/git-token.js';
import { buildApiBaseUrl } from '@chief-clancy/core/shared/remote.js';

import {
  azdoHandlers,
  bbCloudHandlers,
  bbServerHandlers,
  githubHandlers,
  gitlabHandlers,
} from './rework-builders.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Options for {@link resolvePlatformHandlers}. */
type ResolveHandlersOpts = {
  readonly fetchFn: FetchFn;
  readonly env: SharedEnv;
  readonly remote: RemoteInfo;
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve platform handlers for the given remote.
 *
 * @param opts - Resolution options (fetch function, shared env, remote info).
 * @returns A handler object, or `undefined` if the platform is unsupported
 *   or credentials/API base are missing.
 */
export function resolvePlatformHandlers(
  opts: ResolveHandlersOpts,
): PlatformReworkHandlers | undefined {
  const { fetchFn, env, remote } = opts;

  const creds = resolveGitToken(env, remote);
  if (!creds) return undefined;

  const apiBase = buildApiBaseUrl(remote, env.CLANCY_GIT_API_URL);
  if (!apiBase) return undefined;

  const ctx: ReworkCtx = {
    fetchFn,
    token: creds.token,
    apiBase,
    username: creds.username,
  };

  switch (remote.host) {
    case 'github':
      return githubHandlers(ctx, remote);
    case 'gitlab':
      return gitlabHandlers(ctx, remote);
    case 'bitbucket':
      return bbCloudHandlers(ctx, remote);
    case 'bitbucket-server':
      return bbServerHandlers(ctx, remote);
    case 'azure':
      return azdoHandlers(ctx, remote);
    default:
      return undefined;
  }
}
