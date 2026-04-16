import type {
  AzdoRemote,
  GenericRemote,
  GitHubRemote,
  NoRemote,
  PrCreationResult,
  RemoteInfo,
} from '@chief-clancy/core/types/remote.js';

import { describe, expect, it } from 'vitest';

import { deliveryOutcome, progressForOutcome } from './outcome.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const githubRemote: GitHubRemote = {
  host: 'github',
  owner: 'acme',
  repo: 'app',
  hostname: 'github.com',
};

const azdoRemote: AzdoRemote = {
  host: 'azure',
  org: 'acme',
  project: 'platform',
  repo: 'app',
  hostname: 'dev.azure.com',
};

function makeOpts(overrides: {
  readonly pr?: PrCreationResult | undefined;
  readonly remote?: RemoteInfo;
}) {
  return {
    pr: overrides.pr,
    remote: overrides.remote ?? githubRemote,
    sourceBranch: 'feature/proj-42',
    targetBranch: 'main',
  };
}

// ─── deliveryOutcome ──────────────────────────────────────────────────

describe('deliveryOutcome', () => {
  it('returns created when PR was created successfully', () => {
    const pr: PrCreationResult = {
      ok: true,
      url: 'https://github.com/acme/app/pull/5',
      number: 5,
    };

    const outcome = deliveryOutcome(makeOpts({ pr }));

    expect(outcome).toEqual({
      type: 'created',
      url: 'https://github.com/acme/app/pull/5',
      number: 5,
    });
  });

  it('returns exists when PR already exists', () => {
    const pr: PrCreationResult = {
      ok: false,
      error: 'already exists',
      alreadyExists: true,
    };

    const outcome = deliveryOutcome(makeOpts({ pr }));

    expect(outcome.type).toBe('exists');
  });

  it('returns failed with manual URL when PR creation failed', () => {
    const pr: PrCreationResult = {
      ok: false,
      error: 'validation failed',
    };

    const outcome = deliveryOutcome(makeOpts({ pr }));

    expect(outcome.type).toBe('failed');
    if (outcome.type === 'failed') {
      expect(outcome.error).toBe('validation failed');
      expect(outcome.manualUrl).toContain('github.com/acme/app/compare');
    }
  });

  it('returns not_attempted with manual URL when pr is undefined', () => {
    const outcome = deliveryOutcome(makeOpts({ pr: undefined }));

    expect(outcome.type).toBe('not_attempted');
    if (outcome.type === 'not_attempted') {
      expect(outcome.manualUrl).toContain('github.com/acme/app/compare');
    }
  });

  it('returns local for none remote', () => {
    const remote: NoRemote = { host: 'none' };
    const outcome = deliveryOutcome(makeOpts({ pr: undefined, remote }));

    expect(outcome.type).toBe('local');
  });

  it('returns unsupported for unknown remote', () => {
    const remote: GenericRemote = { host: 'unknown', url: 'x' };
    const outcome = deliveryOutcome(makeOpts({ pr: undefined, remote }));

    expect(outcome.type).toBe('unsupported');
  });

  it('returns created for Azure DevOps PR', () => {
    const pr: PrCreationResult = {
      ok: true,
      url: 'https://dev.azure.com/acme/platform/_git/app/pullrequest/3',
      number: 3,
    };

    const outcome = deliveryOutcome(makeOpts({ pr, remote: azdoRemote }));

    expect(outcome).toEqual({
      type: 'created',
      url: 'https://dev.azure.com/acme/platform/_git/app/pullrequest/3',
      number: 3,
    });
  });

  it('returns failed with Azure manual URL on PR failure', () => {
    const pr: PrCreationResult = { ok: false, error: 'server error' };

    const outcome = deliveryOutcome(makeOpts({ pr, remote: azdoRemote }));

    expect(outcome.type).toBe('failed');
    if (outcome.type === 'failed') {
      expect(outcome.manualUrl).toContain('dev.azure.com/acme/platform');
    }
  });

  it('returns not_attempted with Azure manual URL when no creds', () => {
    const outcome = deliveryOutcome(
      makeOpts({ pr: undefined, remote: azdoRemote }),
    );

    expect(outcome.type).toBe('not_attempted');
    if (outcome.type === 'not_attempted') {
      expect(outcome.manualUrl).toContain('dev.azure.com/acme/platform');
    }
  });
});

// ─── progressForOutcome ──────────────────────────────────────────────────────

describe('progressForOutcome', () => {
  it('maps created to PR_CREATED with prNumber', () => {
    expect(
      progressForOutcome({ type: 'created', url: 'x', number: 5 }),
    ).toEqual({ status: 'PR_CREATED', prNumber: 5 });
  });

  it('maps local to LOCAL', () => {
    expect(progressForOutcome({ type: 'local' })).toEqual({
      status: 'LOCAL',
    });
  });

  it('maps exists to PUSHED', () => {
    expect(progressForOutcome({ type: 'exists' })).toEqual({
      status: 'PUSHED',
    });
  });

  it('maps failed to PUSHED', () => {
    expect(progressForOutcome({ type: 'failed', error: 'err' })).toEqual({
      status: 'PUSHED',
    });
  });

  it('maps not_attempted to PUSHED', () => {
    expect(progressForOutcome({ type: 'not_attempted' })).toEqual({
      status: 'PUSHED',
    });
  });

  it('maps unsupported to PUSHED', () => {
    expect(progressForOutcome({ type: 'unsupported' })).toEqual({
      status: 'PUSHED',
    });
  });
});
