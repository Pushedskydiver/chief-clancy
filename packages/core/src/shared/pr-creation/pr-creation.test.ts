import type {
  AzdoRemote,
  BitbucketRemote,
  BitbucketServerRemote,
  GenericRemote,
  GitHubRemote,
  GitLabRemote,
  NoRemote,
} from '~/c/types/remote.js';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { attemptPrCreation, buildManualPrUrl } from './pr-creation.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockFetchFn = vi.fn((url: string, _init: RequestInit) =>
  Promise.resolve(
    new Response(JSON.stringify({ html_url: url, number: 1 }), {
      status: 201,
    }),
  ),
);

type EnvParam = Parameters<typeof attemptPrCreation>[0]['env'];

function githubEnv(): EnvParam {
  return {
    GITHUB_TOKEN: 'ghp_test',
    CLANCY_GIT_API_URL: undefined,
  } as EnvParam;
}

function gitlabEnv(): EnvParam {
  return {
    GITLAB_TOKEN: 'glpat_test',
    CLANCY_GIT_API_URL: undefined,
  } as EnvParam;
}

function bitbucketEnv(): EnvParam {
  return {
    BITBUCKET_USER: 'bbuser',
    BITBUCKET_TOKEN: 'bbtoken',
    CLANCY_GIT_API_URL: undefined,
  } as EnvParam;
}

function azdoEnv(): EnvParam {
  return {
    AZDO_PAT: 'azdo_pat_test',
    CLANCY_GIT_API_URL: undefined,
  } as EnvParam;
}

function emptyEnv(): EnvParam {
  return { CLANCY_GIT_API_URL: undefined } as EnvParam;
}

const githubRemote: GitHubRemote = {
  host: 'github',
  owner: 'acme',
  repo: 'app',
  hostname: 'github.com',
};

const gitlabRemote: GitLabRemote = {
  host: 'gitlab',
  projectPath: 'acme/app',
  hostname: 'gitlab.com',
};

const bbCloudRemote: BitbucketRemote = {
  host: 'bitbucket',
  workspace: 'acme',
  repoSlug: 'app',
  hostname: 'bitbucket.org',
};

const bbServerRemote: BitbucketServerRemote = {
  host: 'bitbucket-server',
  projectKey: 'ACME',
  repoSlug: 'app',
  hostname: 'bitbucket.internal.com',
};

const azdoRemote: AzdoRemote = {
  host: 'azure',
  org: 'acme',
  project: 'platform',
  repo: 'app',
  hostname: 'dev.azure.com',
};

const branchOpts = {
  sourceBranch: 'feature/proj-42',
  targetBranch: 'main',
  title: 'feat(PROJ-42): Add login',
  body: '## Summary\n\nAdds login page.',
};

// ─── attemptPrCreation ───────────────────────────────────────────────────────

describe('attemptPrCreation', () => {
  beforeEach(() => {
    mockFetchFn.mockClear();
  });

  it('dispatches to GitHub', async () => {
    const result = await attemptPrCreation({
      fetchFn: mockFetchFn,
      env: githubEnv(),
      remote: githubRemote,
      ...branchOpts,
    });

    expect(result).toBeDefined();
    const url = mockFetchFn.mock.calls[0]![0];
    expect(url).toContain('api.github.com');
  });

  it('dispatches to GitLab', async () => {
    const result = await attemptPrCreation({
      fetchFn: mockFetchFn,
      env: gitlabEnv(),
      remote: gitlabRemote,
      ...branchOpts,
    });

    expect(result).toBeDefined();
    const url = mockFetchFn.mock.calls[0]![0];
    expect(url).toContain('gitlab.com/api/v4');
  });

  it('dispatches to Bitbucket Cloud', async () => {
    const result = await attemptPrCreation({
      fetchFn: mockFetchFn,
      env: bitbucketEnv(),
      remote: bbCloudRemote,
      ...branchOpts,
    });

    expect(result).toBeDefined();
    const url = mockFetchFn.mock.calls[0]![0];
    expect(url).toContain('api.bitbucket.org');
  });

  it('dispatches to Bitbucket Server', async () => {
    const result = await attemptPrCreation({
      fetchFn: mockFetchFn,
      env: bitbucketEnv(),
      remote: bbServerRemote,
      ...branchOpts,
    });

    expect(result).toBeDefined();
    const url = mockFetchFn.mock.calls[0]![0];
    expect(url).toContain('bitbucket.internal.com');
  });

  it('dispatches to Azure DevOps', async () => {
    const result = await attemptPrCreation({
      fetchFn: mockFetchFn,
      env: azdoEnv(),
      remote: azdoRemote,
      ...branchOpts,
    });

    expect(result).toBeDefined();
    const url = mockFetchFn.mock.calls[0]![0];
    expect(url).toContain('dev.azure.com');
  });

  it('returns undefined when credentials are missing', async () => {
    const result = await attemptPrCreation({
      fetchFn: mockFetchFn,
      env: emptyEnv(),
      remote: githubRemote,
      ...branchOpts,
    });

    expect(result).toBeUndefined();
  });

  it('returns undefined for unknown remote', async () => {
    const remote: GenericRemote = { host: 'unknown', url: 'x' };
    const result = await attemptPrCreation({
      fetchFn: mockFetchFn,
      env: githubEnv(),
      remote,
      ...branchOpts,
    });

    expect(result).toBeUndefined();
  });

  it('returns undefined for none remote', async () => {
    const remote: NoRemote = { host: 'none' };
    const result = await attemptPrCreation({
      fetchFn: mockFetchFn,
      env: githubEnv(),
      remote,
      ...branchOpts,
    });

    expect(result).toBeUndefined();
  });
});

// ─── buildManualPrUrl ────────────────────────────────────────────────────────

describe('buildManualPrUrl', () => {
  it('builds GitHub compare URL', () => {
    const url = buildManualPrUrl(githubRemote, 'feature/x', 'main');

    expect(url).toBe('https://github.com/acme/app/compare/main...feature%2Fx');
  });

  it('builds GitLab MR URL', () => {
    const url = buildManualPrUrl(gitlabRemote, 'feature/x', 'main');

    expect(url).toContain('gitlab.com/acme/app/-/merge_requests/new');
    expect(url).toContain('source_branch]=feature%2Fx');
    expect(url).toContain('target_branch]=main');
  });

  it('builds Bitbucket Cloud PR URL', () => {
    const url = buildManualPrUrl(bbCloudRemote, 'feature/x', 'main');

    expect(url).toContain('bitbucket.org/acme/app/pull-requests/new');
    expect(url).toContain('source=feature%2Fx');
    expect(url).toContain('dest=main');
  });

  it('builds Bitbucket Server PR URL', () => {
    const url = buildManualPrUrl(bbServerRemote, 'feature/x', 'main');

    expect(url).toContain(
      'bitbucket.internal.com/projects/ACME/repos/app/pull-requests',
    );
    expect(url).toContain('sourceBranch=refs/heads/feature%2Fx');
    expect(url).toContain('targetBranch=refs/heads/main');
  });

  it('builds Azure DevOps PR URL', () => {
    const url = buildManualPrUrl(azdoRemote, 'feature/x', 'main');

    expect(url).toContain(
      'dev.azure.com/acme/platform/_git/app/pullrequestcreate',
    );
    expect(url).toContain('sourceRef=feature%2Fx');
    expect(url).toContain('targetRef=main');
  });

  it('returns undefined for unknown remote', () => {
    const remote: GenericRemote = { host: 'unknown', url: 'x' };

    expect(buildManualPrUrl(remote, 'feature/x', 'main')).toBeUndefined();
  });

  it('returns undefined for none remote', () => {
    const remote: NoRemote = { host: 'none' };

    expect(buildManualPrUrl(remote, 'feature/x', 'main')).toBeUndefined();
  });
});
