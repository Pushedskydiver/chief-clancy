import type { BranchSetupDeps } from './branch-setup.js';
import type { FetchedTicket } from '~/c/types/board.js';

import { describe, expect, it, vi } from 'vitest';

import { makeCtx } from '../test-helpers.js';
import { branchSetup } from './branch-setup.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TICKET: FetchedTicket = {
  key: 'PROJ-42',
  title: 'Add login page',
  description: 'Build a login form',
  parentInfo: 'PROJ-100',
  blockers: 'None',
};

const NO_PARENT_TICKET: FetchedTicket = {
  key: 'PROJ-42',
  title: 'Add login page',
  description: '',
  parentInfo: 'none',
  blockers: 'None',
};

function makeDeps(overrides: Partial<BranchSetupDeps> = {}): BranchSetupDeps {
  return {
    currentBranch: vi.fn(() => 'main'),
    checkout: vi.fn(),
    fetchRemoteBranch: vi.fn(() => false),
    ensureBranch: vi.fn(),
    ensureEpicBranch: vi.fn(() => ({ ok: true })),
    fetchChildrenStatus: vi.fn(() => Promise.resolve(undefined)),
    writeLock: vi.fn(),
    ...overrides,
  };
}

function setupCtx(
  opts: {
    readonly ticket?: FetchedTicket;
    readonly isRework?: boolean;
  } = {},
) {
  const ctx = makeCtx();
  ctx.setTicket(opts.ticket ?? TICKET);
  ctx.setTicketBranches({
    ticketBranch: 'feature/proj-42',
    targetBranch: 'epic/proj-100',
    baseBranch: 'main',
    hasParent: (opts.ticket ?? TICKET).parentInfo !== 'none',
  });
  if (opts.isRework) {
    ctx.setRework({ isRework: true });
  }
  return ctx;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('branchSetup', () => {
  // ── originalBranch ────────────────────────────────────────────────

  it('stores the current branch as originalBranch', async () => {
    const ctx = setupCtx();
    const deps = makeDeps({ currentBranch: vi.fn(() => 'develop') });

    await branchSetup(ctx, deps);

    expect(ctx.originalBranch).toBe('develop');
  });

  // ── single-child detection ────────────────────────────────────────

  it('skips epic branch when parent has exactly 1 child', async () => {
    const ctx = setupCtx();
    const deps = makeDeps({
      fetchChildrenStatus: vi.fn(() =>
        Promise.resolve({ total: 1, incomplete: 0 }),
      ),
    });

    await branchSetup(ctx, deps);

    expect(ctx.skipEpicBranch).toBe(true);
    expect(ctx.effectiveTarget).toBe('main');
  });

  it('uses epic branch when parent has multiple children', async () => {
    const ctx = setupCtx();
    const deps = makeDeps({
      fetchChildrenStatus: vi.fn(() =>
        Promise.resolve({ total: 3, incomplete: 1 }),
      ),
    });

    await branchSetup(ctx, deps);

    expect(ctx.skipEpicBranch).toBe(false);
    expect(ctx.effectiveTarget).toBe('epic/proj-100');
  });

  it('passes the full ticket to fetchChildrenStatus', async () => {
    const ctx = setupCtx();
    const fetchChildrenStatus = vi.fn(() =>
      Promise.resolve({ total: 2, incomplete: 1 }),
    );
    const deps = makeDeps({ fetchChildrenStatus });

    await branchSetup(ctx, deps);

    expect(fetchChildrenStatus).toHaveBeenCalledWith(TICKET);
  });

  it('does not skip epic branch when fetchChildrenStatus returns undefined', async () => {
    const ctx = setupCtx();
    const deps = makeDeps({
      fetchChildrenStatus: vi.fn(() => Promise.resolve(undefined)),
    });

    await branchSetup(ctx, deps);

    expect(ctx.skipEpicBranch).toBe(false);
    expect(ctx.effectiveTarget).toBe('epic/proj-100');
  });

  it('skips single-child check for rework tickets', async () => {
    const ctx = setupCtx({ isRework: true });
    const deps = makeDeps();

    await branchSetup(ctx, deps);

    expect(deps.fetchChildrenStatus).not.toHaveBeenCalled();
    expect(ctx.skipEpicBranch).toBe(false);
  });

  it('skips single-child check for standalone tickets', async () => {
    const ctx = setupCtx({ ticket: NO_PARENT_TICKET });
    const deps = makeDeps();

    await branchSetup(ctx, deps);

    expect(deps.fetchChildrenStatus).not.toHaveBeenCalled();
  });

  // ── standalone flow ───────────────────────────────────────────────

  it('branches from base for standalone ticket', async () => {
    const ctx = setupCtx({ ticket: NO_PARENT_TICKET });
    const deps = makeDeps();

    await branchSetup(ctx, deps);

    expect(deps.ensureBranch).toHaveBeenCalledWith('main', 'main');
    expect(deps.checkout).toHaveBeenCalledWith('main');
    expect(deps.checkout).toHaveBeenCalledWith('feature/proj-42', true);
    expect(ctx.effectiveTarget).toBe('main');
  });

  // ── epic branch flow ──────────────────────────────────────────────

  it('creates feature branch from epic branch when parented', async () => {
    const ctx = setupCtx();
    const deps = makeDeps({
      fetchChildrenStatus: vi.fn(() =>
        Promise.resolve({ total: 2, incomplete: 1 }),
      ),
    });

    await branchSetup(ctx, deps);

    expect(deps.ensureEpicBranch).toHaveBeenCalledWith('epic/proj-100', 'main');
    expect(deps.checkout).toHaveBeenCalledWith('epic/proj-100');
    expect(deps.checkout).toHaveBeenCalledWith('feature/proj-42', true);
  });

  it('returns ok: false when ensureEpicBranch fails', async () => {
    const ctx = setupCtx();
    const deps = makeDeps({
      fetchChildrenStatus: vi.fn(() =>
        Promise.resolve({ total: 2, incomplete: 1 }),
      ),
      ensureEpicBranch: vi.fn(() => ({
        ok: false,
        error: 'remote fetch failed',
      })),
    });

    const result = await branchSetup(ctx, deps);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('remote fetch failed');
  });

  it('restores original branch on epic branch failure', async () => {
    const ctx = setupCtx();
    const deps = makeDeps({
      currentBranch: vi.fn(() => 'develop'),
      fetchChildrenStatus: vi.fn(() =>
        Promise.resolve({ total: 2, incomplete: 1 }),
      ),
      ensureEpicBranch: vi.fn(() => ({ ok: false })),
    });

    await branchSetup(ctx, deps);

    expect(deps.checkout).toHaveBeenCalledWith('develop');
  });

  // ── rework flow ───────────────────────────────────────────────────

  it('fetches remote branch for rework and checks out if found', async () => {
    const ctx = setupCtx({ isRework: true });
    const deps = makeDeps({
      fetchRemoteBranch: vi.fn(() => true),
    });

    await branchSetup(ctx, deps);

    expect(deps.fetchRemoteBranch).toHaveBeenCalledWith('feature/proj-42');
    expect(deps.checkout).toHaveBeenCalledWith('feature/proj-42');
  });

  it('creates new branch from effective target when rework branch not found', async () => {
    const ctx = setupCtx({ isRework: true });
    const deps = makeDeps({
      fetchRemoteBranch: vi.fn(() => false),
    });

    await branchSetup(ctx, deps);

    expect(deps.checkout).toHaveBeenCalledWith('epic/proj-100');
    expect(deps.checkout).toHaveBeenCalledWith('feature/proj-42', true);
  });

  it('ensures epic branch exists for parented rework', async () => {
    const ctx = setupCtx({ isRework: true });
    const deps = makeDeps();

    await branchSetup(ctx, deps);

    expect(deps.ensureEpicBranch).toHaveBeenCalledWith('epic/proj-100', 'main');
  });

  it('returns ok: false when epic branch fails during rework', async () => {
    const ctx = setupCtx({ isRework: true });
    const deps = makeDeps({
      ensureEpicBranch: vi.fn(() => ({ ok: false, error: 'failed' })),
    });

    const result = await branchSetup(ctx, deps);

    expect(result.ok).toBe(false);
  });

  it('uses ensureBranch for standalone rework', async () => {
    const ctx = setupCtx({ ticket: NO_PARENT_TICKET, isRework: true });
    const deps = makeDeps();

    await branchSetup(ctx, deps);

    expect(deps.ensureBranch).toHaveBeenCalledWith('main', 'main');
    expect(deps.ensureEpicBranch).not.toHaveBeenCalled();
  });

  // ── lock write ────────────────────────────────────────────────────

  it('writes lock file on success and sets lockOwner', async () => {
    const ctx = setupCtx({ ticket: NO_PARENT_TICKET });
    const deps = makeDeps();

    await branchSetup(ctx, deps);

    expect(deps.writeLock).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketKey: 'PROJ-42',
        ticketBranch: 'feature/proj-42',
        targetBranch: 'main',
      }),
    );
    expect(ctx.lockOwner).toBe(true);
  });

  it('writes description as undefined when ticket description is undefined', async () => {
    const undefinedDescTicket: FetchedTicket = {
      ...NO_PARENT_TICKET,
      description: undefined as unknown as string,
    };
    const ctx = setupCtx({ ticket: undefinedDescTicket });
    const deps = makeDeps();

    await branchSetup(ctx, deps);

    expect(vi.mocked(deps.writeLock)).toHaveBeenCalledWith(
      expect.objectContaining({ description: undefined }),
    );
  });

  it('continues without lockOwner when writeLock throws', async () => {
    const ctx = setupCtx({ ticket: NO_PARENT_TICKET });
    const deps = makeDeps({
      writeLock: vi.fn(() => {
        throw new Error('disk full');
      }),
    });

    const result = await branchSetup(ctx, deps);

    expect(result.ok).toBe(true);
    expect(ctx.lockOwner).toBeUndefined();
  });

  // ── context setBranchSetup ────────────────────────────────────────

  it('calls setBranchSetup with computed fields', async () => {
    const ctx = setupCtx();
    const deps = makeDeps({
      currentBranch: vi.fn(() => 'develop'),
      fetchChildrenStatus: vi.fn(() =>
        Promise.resolve({ total: 2, incomplete: 1 }),
      ),
    });

    await branchSetup(ctx, deps);

    expect(ctx.effectiveTarget).toBe('epic/proj-100');
    expect(ctx.originalBranch).toBe('develop');
    expect(ctx.skipEpicBranch).toBe(false);
  });

  // ── description truncation ────────────────────────────────────────

  it('uses injected now for lock startedAt timestamp', async () => {
    const ctx = setupCtx({ ticket: NO_PARENT_TICKET });
    const deps = makeDeps({
      now: () => '2026-01-15T12:00:00.000Z',
    });

    await branchSetup(ctx, deps);

    expect(vi.mocked(deps.writeLock)).toHaveBeenCalledWith(
      expect.objectContaining({ startedAt: '2026-01-15T12:00:00.000Z' }),
    );
  });

  it('truncates lock description to 2000 chars', async () => {
    const longTicket: FetchedTicket = {
      ...TICKET,
      description: 'x'.repeat(3000),
    };
    const ctx = setupCtx({ ticket: longTicket });
    const deps = makeDeps();

    await branchSetup(ctx, deps);

    const call = vi.mocked(deps.writeLock).mock.calls[0]!;
    const desc = (call[0] as Record<string, unknown>).description as string;
    expect(desc).toHaveLength(2000);
  });
});
