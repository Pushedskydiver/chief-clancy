import type { SharedEnv } from '~/c/schemas/env/env.js';
import type { RemoteInfo } from '~/c/types/remote.js';

import { describe, expect, it } from 'vitest';

import { resolveGitToken } from './git-token.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TokenOverrides = {
  readonly GITHUB_TOKEN?: string;
  readonly GITLAB_TOKEN?: string;
  readonly BITBUCKET_USER?: string;
  readonly BITBUCKET_TOKEN?: string;
  readonly AZDO_PAT?: string;
};

/** Build a minimal SharedEnv with only token fields set. */
function env(overrides: TokenOverrides = {}): SharedEnv {
  return overrides as SharedEnv;
}

const GITHUB_REMOTE: RemoteInfo = {
  host: 'github',
  owner: 'acme',
  repo: 'app',
  hostname: 'github.com',
};

const GITLAB_REMOTE: RemoteInfo = {
  host: 'gitlab',
  projectPath: 'acme/app',
  hostname: 'gitlab.com',
};

const BITBUCKET_REMOTE: RemoteInfo = {
  host: 'bitbucket',
  workspace: 'acme',
  repoSlug: 'app',
  hostname: 'bitbucket.org',
};

const BITBUCKET_SERVER_REMOTE: RemoteInfo = {
  host: 'bitbucket-server',
  projectKey: 'ACME',
  repoSlug: 'app',
  hostname: 'bitbucket.example.com',
};

const AZURE_REMOTE: RemoteInfo = {
  host: 'azure',
  url: 'https://dev.azure.com/myorg/myproject/_git/app',
};

const UNKNOWN_REMOTE: RemoteInfo = {
  host: 'unknown',
  url: 'https://custom.example.com/repo.git',
};

const NO_REMOTE: RemoteInfo = { host: 'none' };

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('resolveGitToken', () => {
  describe('GitHub remote', () => {
    it('returns token when GITHUB_TOKEN is present', () => {
      const result = resolveGitToken(
        env({ GITHUB_TOKEN: 'gh-token-abc' }),
        GITHUB_REMOTE,
      );

      expect(result).toStrictEqual({ token: 'gh-token-abc' });
    });

    it('returns undefined when GITHUB_TOKEN is missing', () => {
      const result = resolveGitToken(env(), GITHUB_REMOTE);

      expect(result).toBeUndefined();
    });
  });

  describe('GitLab remote', () => {
    it('returns token when GITLAB_TOKEN is present', () => {
      const result = resolveGitToken(
        env({ GITLAB_TOKEN: 'gl-token-xyz' }),
        GITLAB_REMOTE,
      );

      expect(result).toStrictEqual({ token: 'gl-token-xyz' });
    });

    it('returns undefined when GITLAB_TOKEN is missing', () => {
      const result = resolveGitToken(env(), GITLAB_REMOTE);

      expect(result).toBeUndefined();
    });
  });

  describe('Bitbucket Cloud remote', () => {
    it('returns token and username when both are present', () => {
      const result = resolveGitToken(
        env({ BITBUCKET_USER: 'bb-user', BITBUCKET_TOKEN: 'bb-token' }),
        BITBUCKET_REMOTE,
      );

      expect(result).toStrictEqual({ token: 'bb-token', username: 'bb-user' });
    });

    it('returns undefined when BITBUCKET_USER is missing', () => {
      const result = resolveGitToken(
        env({ BITBUCKET_TOKEN: 'bb-token' }),
        BITBUCKET_REMOTE,
      );

      expect(result).toBeUndefined();
    });

    it('returns undefined when BITBUCKET_TOKEN is missing', () => {
      const result = resolveGitToken(
        env({ BITBUCKET_USER: 'bb-user' }),
        BITBUCKET_REMOTE,
      );

      expect(result).toBeUndefined();
    });
  });

  describe('Bitbucket Server remote', () => {
    it('returns token when BITBUCKET_TOKEN is present', () => {
      const result = resolveGitToken(
        env({ BITBUCKET_TOKEN: 'bbs-token' }),
        BITBUCKET_SERVER_REMOTE,
      );

      expect(result).toStrictEqual({ token: 'bbs-token' });
    });

    it('returns undefined when BITBUCKET_TOKEN is missing', () => {
      const result = resolveGitToken(env(), BITBUCKET_SERVER_REMOTE);

      expect(result).toBeUndefined();
    });
  });

  describe('Azure DevOps remote', () => {
    it('returns token when AZDO_PAT is present', () => {
      const result = resolveGitToken(env({ AZDO_PAT: 'my-pat' }), AZURE_REMOTE);

      expect(result).toStrictEqual({ token: 'my-pat' });
    });

    it('returns undefined when AZDO_PAT is missing', () => {
      const result = resolveGitToken(env(), AZURE_REMOTE);

      expect(result).toBeUndefined();
    });
  });

  describe('unsupported remotes', () => {
    it('returns undefined for unknown remote', () => {
      const result = resolveGitToken(
        env({ GITHUB_TOKEN: 'gh-token' }),
        UNKNOWN_REMOTE,
      );

      expect(result).toBeUndefined();
    });

    it('returns undefined for no remote', () => {
      const result = resolveGitToken(
        env({ GITHUB_TOKEN: 'gh-token' }),
        NO_REMOTE,
      );

      expect(result).toBeUndefined();
    });
  });
});
