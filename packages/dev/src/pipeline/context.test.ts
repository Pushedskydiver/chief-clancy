import type { BoardConfig } from '@chief-clancy/core/schemas/env/env.js';
import type { Board } from '@chief-clancy/core/types/board.js';

import { describe, expect, it } from 'vitest';

import { createContext, RunContext } from './context.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULTS = {
  projectRoot: '/project',
  argv: ['--dry-run'],
} as const;

function makeBoard(): Board {
  return {
    ping: async () => ({ ok: true }),
    validateInputs: () => undefined,
    fetchTicket: async () => undefined,
    fetchTickets: async () => [],
    fetchBlockerStatus: async () => false,
    fetchChildrenStatus: async () => undefined,
    transitionTicket: async () => true,
    ensureLabel: async () => undefined,
    addLabel: async () => undefined,
    removeLabel: async () => undefined,
    sharedEnv: () => ({}),
  };
}

// ─── RunContext class ────────────────────────────────────────────────────────

describe('RunContext', () => {
  it('is a class (not a plain object)', () => {
    const ctx = createContext(DEFAULTS);

    expect(ctx).toBeInstanceOf(RunContext);
  });

  it('stores fixed fields from creation options', () => {
    const ctx = createContext({
      projectRoot: '/my/project',
      argv: ['--dry-run', '--skip-feasibility'],
      isAfk: true,
    });

    expect(ctx.projectRoot).toBe('/my/project');
    expect(ctx.argv).toEqual(['--dry-run', '--skip-feasibility']);
    expect(ctx.dryRun).toBe(true);
    expect(ctx.skipFeasibility).toBe(true);
    expect(ctx.isAfk).toBe(true);
    expect(ctx.startTime).toBeGreaterThan(0);
  });

  it('defaults isAfk to false', () => {
    const ctx = createContext(DEFAULTS);

    expect(ctx.isAfk).toBe(false);
  });

  it('defaults dryRun and skipFeasibility based on argv', () => {
    const ctx = createContext({ projectRoot: '/p', argv: [] });

    expect(ctx.dryRun).toBe(false);
    expect(ctx.skipFeasibility).toBe(false);
  });

  it('populates fields via setter methods', () => {
    const ctx = createContext(DEFAULTS);
    const board = makeBoard();
    const config = { provider: 'github' as const, env: {} } as BoardConfig;

    const ticket = {
      key: 'PROJ-42',
      title: 'Add login',
      description: '',
      parentInfo: '',
      blockers: 'None',
    };

    ctx.setPreflight(config, board);
    ctx.setRework({ isRework: true, prFeedback: ['fix the bug'] });
    ctx.setTicket(ticket);
    ctx.setBranchSetup({
      ticketBranch: 'feat/proj-42',
      targetBranch: 'main',
      effectiveTarget: 'main',
    });
    ctx.setLockOwner(true);

    expect(ctx.config).toBe(config);
    expect(ctx.board).toBe(board);
    expect(ctx.isRework).toBe(true);
    expect(ctx.prFeedback).toEqual(['fix the bug']);
    expect(ctx.ticket).toBe(ticket);
    expect(ctx.ticketBranch).toBe('feat/proj-42');
    expect(ctx.lockOwner).toBe(true);
  });

  it('populates ticket branch fields via setTicketBranches', () => {
    const ctx = createContext(DEFAULTS);

    ctx.setTicketBranches({
      ticketBranch: 'feature/proj-42',
      targetBranch: 'epic/proj-100',
      baseBranch: 'main',
      hasParent: true,
    });

    expect(ctx.ticketBranch).toBe('feature/proj-42');
    expect(ctx.targetBranch).toBe('epic/proj-100');
    expect(ctx.baseBranch).toBe('main');
    expect(ctx.hasParent).toBe(true);
  });

  it('starts with undefined phase-populated fields', () => {
    const ctx = createContext(DEFAULTS);

    // Preflight
    expect(ctx.config).toBeUndefined();
    expect(ctx.board).toBeUndefined();
    // Rework / ticket-fetch
    expect(ctx.ticket).toBeUndefined();
    expect(ctx.isRework).toBeUndefined();
    expect(ctx.prFeedback).toBeUndefined();
    expect(ctx.reworkPrNumber).toBeUndefined();
    expect(ctx.reworkDiscussionIds).toBeUndefined();
    expect(ctx.reworkReviewers).toBeUndefined();
    // Branch-setup
    expect(ctx.ticketBranch).toBeUndefined();
    expect(ctx.targetBranch).toBeUndefined();
    expect(ctx.effectiveTarget).toBeUndefined();
    expect(ctx.baseBranch).toBeUndefined();
    expect(ctx.originalBranch).toBeUndefined();
    expect(ctx.skipEpicBranch).toBeUndefined();
    expect(ctx.hasParent).toBeUndefined();
    // Lock-write
    expect(ctx.lockOwner).toBeUndefined();
  });
});

// ─── createContext ────────────────────────────────────────────────────────────

describe('createContext', () => {
  it('captures startTime at creation', () => {
    const before = Date.now();
    const ctx = createContext(DEFAULTS);
    const after = Date.now();

    expect(ctx.startTime).toBeGreaterThanOrEqual(before);
    expect(ctx.startTime).toBeLessThanOrEqual(after);
  });

  it('uses injected now for startTime', () => {
    const ctx = createContext({ ...DEFAULTS, now: 1_700_000_000_000 });

    expect(ctx.startTime).toBe(1_700_000_000_000);
  });

  it('preserves now: 0 (nullish coalescing, not falsy fallback)', () => {
    const ctx = createContext({ ...DEFAULTS, now: 0 });

    expect(ctx.startTime).toBe(0);
  });

  it('parses --dry-run from argv', () => {
    const ctx = createContext({ projectRoot: '/p', argv: ['--dry-run'] });

    expect(ctx.dryRun).toBe(true);
  });

  it('parses --skip-feasibility from argv', () => {
    const ctx = createContext({
      projectRoot: '/p',
      argv: ['--skip-feasibility'],
    });

    expect(ctx.skipFeasibility).toBe(true);
  });

  it('does not treat partial matches as flags', () => {
    const ctx = createContext({
      projectRoot: '/p',
      argv: ['--dry-run-extra', '--skip-feasibility-plus'],
    });

    expect(ctx.dryRun).toBe(false);
    expect(ctx.skipFeasibility).toBe(false);
  });

  it('parses --from path from argv', () => {
    const ctx = createContext({
      projectRoot: '/p',
      argv: ['--from', '.clancy/plans/my-plan.md'],
    });

    expect(ctx.fromPath).toBe('.clancy/plans/my-plan.md');
  });

  it('fromPath is undefined when --from absent', () => {
    const ctx = createContext({ projectRoot: '/p', argv: [] });

    expect(ctx.fromPath).toBeUndefined();
  });

  it('fromPath is undefined when --from has no following value', () => {
    const ctx = createContext({ projectRoot: '/p', argv: ['--from'] });

    expect(ctx.fromPath).toBeUndefined();
  });

  it('fromPath is undefined when --from is followed by another flag', () => {
    const ctx = createContext({
      projectRoot: '/p',
      argv: ['--from', '--dry-run'],
    });

    expect(ctx.fromPath).toBeUndefined();
  });

  it('accepts fromPath from opts (overrides argv)', () => {
    const ctx = createContext({
      projectRoot: '/p',
      argv: ['--from', 'argv-path.md'],
      fromPath: 'opts-path.md',
    });

    expect(ctx.fromPath).toBe('opts-path.md');
  });
});
