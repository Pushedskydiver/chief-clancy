import type { BoardConfig } from '@chief-clancy/core/schemas/env/env.js';

import { describe, expect, it } from 'vitest';

import { dryRun } from './dry-run.js';
import { makeCtx } from './test-helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePopulatedCtx(
  opts: {
    readonly dryRun?: boolean;
    readonly provider?: BoardConfig['provider'];
  } = {},
) {
  const ctx = makeCtx({
    argv: opts.dryRun ? ['--dry-run'] : [],
    provider: opts.provider,
  });

  ctx.setTicket({
    key: '#42',
    title: 'Add login page',
    description: 'Build a login form',
    parentInfo: '#100',
    blockers: 'None',
  });

  ctx.setTicketBranches({
    ticketBranch: 'feature/issue-42',
    targetBranch: 'epic/100',
    baseBranch: 'main',
    hasParent: true,
  });

  return ctx;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('dryRun', () => {
  it('returns isDryRun: false when --dry-run not set', () => {
    const ctx = makePopulatedCtx({ dryRun: false });

    const result = dryRun(ctx);

    expect(result.isDryRun).toBe(false);
    expect(result.ticketInfo).toBeUndefined();
  });

  it('returns isDryRun: true with ticket info when --dry-run set', () => {
    const ctx = makePopulatedCtx({ dryRun: true });

    const result = dryRun(ctx);

    expect(result.isDryRun).toBe(true);
    expect(result.ticketInfo).toBeDefined();
    expect(result.ticketInfo!.key).toBe('#42');
    expect(result.ticketInfo!.title).toBe('Add login page');
    expect(result.ticketInfo!.ticketBranch).toBe('feature/issue-42');
    expect(result.ticketInfo!.targetBranch).toBe('epic/100');
  });

  it('includes rework mode in ticket info when applicable', () => {
    const ctx = makePopulatedCtx({ dryRun: true });
    ctx.setRework({ isRework: true });

    const result = dryRun(ctx);

    expect(result.ticketInfo!.isRework).toBe(true);
  });

  it('includes parent info in ticket info', () => {
    const ctx = makePopulatedCtx({ dryRun: true });

    const result = dryRun(ctx);

    expect(result.ticketInfo!.parentInfo).toBe('#100');
  });

  it('includes description when present', () => {
    const ctx = makePopulatedCtx({ dryRun: true });

    const result = dryRun(ctx);

    expect(result.ticketInfo!.description).toBe('Build a login form');
  });

  it('includes provider in ticket info', () => {
    const ctx = makePopulatedCtx({ dryRun: true, provider: 'jira' });

    const result = dryRun(ctx);

    expect(result.ticketInfo!.provider).toBe('jira');
  });

  it('includes blockers for non-github providers', () => {
    const ctx = makePopulatedCtx({ dryRun: true, provider: 'jira' });

    const result = dryRun(ctx);

    expect(result.ticketInfo!.blockers).toBe('None');
  });
});
