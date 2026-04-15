import type { SharedEnv } from '~/c/schemas/env.js';
import type { RemoteInfo } from '~/c/types/remote.js';

/** Resolved git host credentials. */
type GitCredentials = {
  readonly token: string;
  readonly username?: string;
};

/** Map a git platform to its simple token env var. */
function simpleToken(env: SharedEnv, host: string): string | undefined {
  const tokenMap: Record<string, string | undefined> = {
    github: env.GITHUB_TOKEN,
    gitlab: env.GITLAB_TOKEN,
    'bitbucket-server': env.BITBUCKET_TOKEN,
    azure: env.AZDO_PAT,
  };
  return tokenMap[host];
}

/**
 * Resolve a git host token from the board config's env.
 *
 * Switches on `remote.host` to extract the correct credential from the
 * shared env vars (`GITHUB_TOKEN`, `GITLAB_TOKEN`, `BITBUCKET_*`, `AZDO_PAT`).
 *
 * @returns Credentials for the git platform, or `undefined` if none found.
 */
export function resolveGitToken(
  env: SharedEnv,
  remote: RemoteInfo,
): GitCredentials | undefined {
  if (remote.host === 'bitbucket') {
    return env.BITBUCKET_USER && env.BITBUCKET_TOKEN
      ? { token: env.BITBUCKET_TOKEN, username: env.BITBUCKET_USER }
      : undefined;
  }

  const token = simpleToken(env, remote.host);
  return token ? { token } : undefined;
}
