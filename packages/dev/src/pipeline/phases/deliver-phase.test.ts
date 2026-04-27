import type { DeliverPhaseDeps } from './deliver-phase.js';
import type { BoardConfig } from '@chief-clancy/core/schemas/env.js';

import { describe, expect, it, vi } from 'vitest';

import { deliverPhase } from './deliver-phase.js';
import { makeCtx } from './test-helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TICKET = {
  key: 'PROJ-1',
  title: 'Test ticket',
  description: 'A description',
  parentInfo: 'PROJ-100',
  blockers: 'None',
} as const;

function makeDeps(overrides: Partial<DeliverPhaseDeps> = {}): DeliverPhaseDeps {
  return {
    deliverViaPullRequest: vi
      .fn()
      .mockResolvedValue({ isPushed: true, outcome: { type: 'created' } }),
    appendProgress: vi.fn(),
    recordDelivery: vi.fn(),
    recordRework: vi.fn(),
    postReworkActions: vi.fn().mockResolvedValue(undefined),
    removeBuildLabel: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

type SetupOpts = {
  readonly isRework?: boolean;
  readonly hasParent?: boolean;
  readonly skipEpicBranch?: boolean;
  readonly provider?: BoardConfig['provider'];
  readonly parentInfo?: string;
  readonly reworkPrNumber?: number | null;
};

function buildReworkOpts(opts: SetupOpts) {
  const isRework = opts.isRework ?? false;
  const prNumber =
    opts.reworkPrNumber === null
      ? undefined
      : (opts.reworkPrNumber ?? (isRework ? 42 : undefined));

  return {
    isRework,
    prFeedback: isRework ? (['Fix tests'] as const) : undefined,
    reworkPrNumber: prNumber,
    reworkDiscussionIds: isRework ? (['d1'] as const) : undefined,
    reworkReviewers: isRework ? (['alice'] as const) : undefined,
  };
}

function setupCtx(opts: SetupOpts = {}) {
  const ctx = makeCtx({ provider: opts.provider ?? 'github' });
  ctx.setTicket({
    ...TICKET,
    parentInfo: opts.parentInfo ?? TICKET.parentInfo,
  });
  ctx.setRework(buildReworkOpts(opts));
  ctx.setBranchSetup({
    ticketBranch: 'feat/proj-1',
    targetBranch: 'epic/proj-100',
    effectiveTarget: 'epic/proj-100',
    baseBranch: 'main',
    originalBranch: 'main',
    skipEpicBranch: opts.skipEpicBranch ?? false,
    hasParent: opts.hasParent ?? true,
  });

  return ctx;
}

// ─── Fresh delivery tests ────────────────────────────────────────────────────

describe('deliverPhase — fresh delivery', () => {
  it('returns ok: true on successful delivery', async () => {
    const ctx = setupCtx({ isRework: false });
    const deps = makeDeps();
    const result = await deliverPhase(ctx, deps);

    expect(result.ok).toBe(true);
  });

  it('calls deliverViaPullRequest with parent key for epic', async () => {
    const ctx = setupCtx({ hasParent: true, skipEpicBranch: false });
    const deps = makeDeps();
    await deliverPhase(ctx, deps);

    expect(deps.deliverViaPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketBranch: 'feat/proj-1',
        targetBranch: 'epic/proj-100',
        parent: 'PROJ-100',
        singleChildParent: undefined,
      }),
    );
  });

  it('passes singleChildParent when skipEpicBranch and valid GitHub ref', async () => {
    const ctx = setupCtx({
      hasParent: true,
      skipEpicBranch: true,
      parentInfo: '#42',
    });
    const deps = makeDeps();
    await deliverPhase(ctx, deps);

    expect(deps.deliverViaPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: undefined,
        singleChildParent: '#42',
      }),
    );
  });

  it('omits singleChildParent for invalid GitHub ref', async () => {
    const ctx = setupCtx({
      hasParent: true,
      skipEpicBranch: true,
      parentInfo: 'Sprint 3',
    });
    const deps = makeDeps();
    await deliverPhase(ctx, deps);

    expect(deps.deliverViaPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: undefined,
        singleChildParent: undefined,
      }),
    );
  });

  it('passes singleChildParent for non-GitHub providers regardless of format', async () => {
    const ctx = setupCtx({
      hasParent: true,
      skipEpicBranch: true,
      parentInfo: 'PROJ-100',
      provider: 'jira',
    });
    const deps = makeDeps();
    await deliverPhase(ctx, deps);

    expect(deps.deliverViaPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        singleChildParent: 'PROJ-100',
      }),
    );
  });

  it('records delivery quality on success', async () => {
    const ctx = setupCtx({ isRework: false });
    const deps = makeDeps();
    await deliverPhase(ctx, deps);

    expect(deps.recordDelivery).toHaveBeenCalledOnce();
  });

  it('returns push-failed tagged error when push fails', async () => {
    const ctx = setupCtx({ isRework: false });
    const deps = makeDeps({
      deliverViaPullRequest: vi
        .fn()
        .mockResolvedValue({ isPushed: false, outcome: { type: 'local' } }),
    });
    const result = await deliverPhase(ctx, deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('push-failed');
      expect(result.error.message).toBe(
        'git push to remote failed (no stderr captured)',
      );
    }
    expect(deps.recordDelivery).not.toHaveBeenCalled();
  });

  it('logs PUSH_FAILED progress when fresh push fails', async () => {
    const ctx = setupCtx({ isRework: false });
    const deps = makeDeps({
      deliverViaPullRequest: vi
        .fn()
        .mockResolvedValue({ isPushed: false, outcome: { type: 'local' } }),
    });
    await deliverPhase(ctx, deps);

    expect(deps.appendProgress).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PUSH_FAILED', key: 'PROJ-1' }),
    );
  });

  it('returns pr-creation-failed tagged error when PR API fails after push', async () => {
    const ctx = setupCtx({ isRework: false });
    const deps = makeDeps({
      deliverViaPullRequest: vi.fn().mockResolvedValue({
        isPushed: true,
        outcome: {
          type: 'failed',
          error: 'API 500',
          manualUrl: 'https://example.com/compare',
        },
        prResult: {
          ok: false,
          error: { kind: 'unknown', message: 'API 500' },
        },
      }),
    });
    const result = await deliverPhase(ctx, deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('pr-creation-failed');
      expect(result.error.message).toBe('API 500');
    }
    expect(deps.recordDelivery).not.toHaveBeenCalled();
  });

  it('logs PR_CREATION_FAILED progress when PR API fails after push', async () => {
    const ctx = setupCtx({ isRework: false });
    const deps = makeDeps({
      deliverViaPullRequest: vi.fn().mockResolvedValue({
        isPushed: true,
        outcome: { type: 'failed', error: 'API 500' },
        prResult: {
          ok: false,
          error: { kind: 'unknown', message: 'API 500' },
        },
      }),
    });
    await deliverPhase(ctx, deps);

    expect(deps.appendProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PR_CREATION_FAILED',
        key: 'PROJ-1',
      }),
    );
  });

  it('returns ok: true when PR already exists (alreadyExists branch)', async () => {
    const ctx = setupCtx({ isRework: false });
    const deps = makeDeps({
      deliverViaPullRequest: vi.fn().mockResolvedValue({
        isPushed: true,
        outcome: { type: 'exists' },
        prResult: {
          ok: false,
          alreadyExists: true,
          error: { kind: 'unknown', message: 'PR already exists' },
        },
      }),
    });
    const result = await deliverPhase(ctx, deps);

    expect(result.ok).toBe(true);
    expect(deps.recordDelivery).toHaveBeenCalledOnce();
  });

  it('removes build label after successful delivery', async () => {
    const ctx = setupCtx({ isRework: false });
    const deps = makeDeps();
    await deliverPhase(ctx, deps);

    expect(deps.removeBuildLabel).toHaveBeenCalledWith('PROJ-1');
  });

  it('does not remove build label when push fails', async () => {
    const ctx = setupCtx({ isRework: false });
    const deps = makeDeps({
      deliverViaPullRequest: vi
        .fn()
        .mockResolvedValue({ isPushed: false, outcome: { type: 'local' } }),
    });
    await deliverPhase(ctx, deps);

    expect(deps.removeBuildLabel).not.toHaveBeenCalled();
  });

  it('returns ok: true even when removeBuildLabel throws', async () => {
    const ctx = setupCtx({ isRework: false });
    const deps = makeDeps({
      removeBuildLabel: vi.fn().mockRejectedValue(new Error('API error')),
    });
    const result = await deliverPhase(ctx, deps);

    expect(result.ok).toBe(true);
  });

  it('sets no parent when hasParent is false', async () => {
    const ctx = setupCtx({ hasParent: false });
    const deps = makeDeps();
    await deliverPhase(ctx, deps);

    expect(deps.deliverViaPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: undefined,
        singleChildParent: undefined,
      }),
    );
  });
});

// ─── Rework delivery tests ──────────────────────────────────────────────────

describe('deliverPhase — rework delivery', () => {
  it('returns ok: true on successful rework delivery', async () => {
    const ctx = setupCtx({ isRework: true });
    const deps = makeDeps();
    const result = await deliverPhase(ctx, deps);

    expect(result.ok).toBe(true);
  });

  it('calls deliverViaPullRequest with shouldSkipLog: true', async () => {
    const ctx = setupCtx({ isRework: true });
    const deps = makeDeps();
    await deliverPhase(ctx, deps);

    expect(deps.deliverViaPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ shouldSkipLog: true }),
    );
  });

  it('logs REWORK progress on success', async () => {
    const ctx = setupCtx({ isRework: true, reworkPrNumber: 42 });
    const deps = makeDeps();
    await deliverPhase(ctx, deps);

    expect(deps.appendProgress).toHaveBeenCalledWith({
      key: 'PROJ-1',
      summary: 'Test ticket',
      status: 'REWORK',
      prNumber: 42,
      parent: 'PROJ-100',
    });
  });

  it('records rework quality on success', async () => {
    const ctx = setupCtx({ isRework: true });
    const deps = makeDeps();
    await deliverPhase(ctx, deps);

    expect(deps.recordRework).toHaveBeenCalledOnce();
  });

  it('calls postReworkActions with rework context', async () => {
    const ctx = setupCtx({ isRework: true, reworkPrNumber: 42 });
    const deps = makeDeps();
    await deliverPhase(ctx, deps);

    expect(deps.postReworkActions).toHaveBeenCalledWith({
      prNumber: 42,
      feedback: ['Fix tests'],
      discussionIds: ['d1'],
      reviewers: ['alice'],
    });
  });

  it('skips postReworkActions when reworkPrNumber is undefined', async () => {
    const ctx = setupCtx({ isRework: true, reworkPrNumber: null });
    const deps = makeDeps();
    await deliverPhase(ctx, deps);

    expect(deps.postReworkActions).not.toHaveBeenCalled();
  });

  it('logs PUSH_FAILED progress when push fails', async () => {
    const ctx = setupCtx({ isRework: true });
    const deps = makeDeps({
      deliverViaPullRequest: vi
        .fn()
        .mockResolvedValue({ isPushed: false, outcome: { type: 'local' } }),
    });
    await deliverPhase(ctx, deps);

    expect(deps.appendProgress).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PUSH_FAILED' }),
    );
  });

  it('returns push-failed tagged error when rework push fails', async () => {
    const ctx = setupCtx({ isRework: true });
    const deps = makeDeps({
      deliverViaPullRequest: vi
        .fn()
        .mockResolvedValue({ isPushed: false, outcome: { type: 'local' } }),
    });
    const result = await deliverPhase(ctx, deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('push-failed');
    }
    expect(deps.recordRework).not.toHaveBeenCalled();
  });

  it('returns pr-creation-failed when rework PR API fails after push', async () => {
    const ctx = setupCtx({ isRework: true });
    const deps = makeDeps({
      deliverViaPullRequest: vi.fn().mockResolvedValue({
        isPushed: true,
        outcome: { type: 'failed', error: 'rework API 503' },
        prResult: {
          ok: false,
          error: { kind: 'unknown', message: 'rework API 503' },
        },
      }),
    });
    const result = await deliverPhase(ctx, deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('pr-creation-failed');
      expect(result.error.message).toBe('rework API 503');
    }
    expect(deps.recordRework).not.toHaveBeenCalled();
  });

  it('removes build label after successful rework delivery', async () => {
    const ctx = setupCtx({ isRework: true });
    const deps = makeDeps();
    await deliverPhase(ctx, deps);

    expect(deps.removeBuildLabel).toHaveBeenCalledWith('PROJ-1');
  });

  it('returns ok: true when postReworkActions throws', async () => {
    const ctx = setupCtx({ isRework: true, reworkPrNumber: 42 });
    const deps = makeDeps({
      postReworkActions: vi.fn().mockRejectedValue(new Error('network error')),
    });
    const result = await deliverPhase(ctx, deps);

    expect(result.ok).toBe(true);
    expect(deps.recordRework).toHaveBeenCalledOnce();
  });
});
