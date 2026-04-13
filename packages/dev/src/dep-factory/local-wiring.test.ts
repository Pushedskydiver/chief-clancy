import { describe, expect, it, vi } from 'vitest';

import { RunContext } from '../pipeline/context.js';
import { localTicketSeed, wirePreflight } from './local-wiring.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(fromPath: string): RunContext {
  return new RunContext({
    projectRoot: '/repo',
    argv: ['--from', fromPath],
  });
}

const PLAN_CONTENT = `## Clancy Implementation Plan

**Ticket:** [PROJ-42] Add dark mode
**Planned:** 2026-04-13

### Summary

Enable dark mode.`;

// ─── localPreflight ──────────────────────────────────────────────────────────

describe('wirePreflight (local path)', () => {
  const noopEnvFs = {
    readFile: vi.fn((): string => {
      throw new Error('ENOENT');
    }),
  };

  const preflight = wirePreflight({
    envFs: noopEnvFs,
    projectRoot: '/repo',
    exec: vi.fn(() => ''),
    fetch: vi.fn(),
  });

  it('sets ctx.config with shortcut provider', async () => {
    const ctx = makeCtx('plan.md');
    await preflight(ctx);
    expect(ctx.config).toBeDefined();
    expect(ctx.config!.provider).toBe('shortcut');
  });

  it('sets ctx.board as no-op stub', async () => {
    const ctx = makeCtx('plan.md');
    await preflight(ctx);
    expect(ctx.board).toBeDefined();
    await expect(ctx.board!.ping()).resolves.toEqual({ ok: true });
  });

  it('returns ok: true', async () => {
    const ctx = makeCtx('plan.md');
    const result = await preflight(ctx);
    expect(result).toEqual({ ok: true });
  });

  it('returns ok: false when not in a git repo', async () => {
    const notGitPreflight = wirePreflight({
      envFs: noopEnvFs,
      projectRoot: '/repo',
      exec: vi.fn(() => {
        throw new Error('not a git repo');
      }),
      fetch: vi.fn(),
    });
    const ctx = makeCtx('plan.md');
    const result = await notGitPreflight(ctx);
    expect(result).toEqual({
      ok: false,
      error: 'Not inside a git repository',
    });
  });
});

// ─── localTicketSeed ─────────────────────────────────────────────────────────

describe('localTicketSeed', () => {
  it('sets ctx.ticket from plan file content', () => {
    const ctx = makeCtx('.clancy/plans/add-dark-mode-1.md');
    const readFile = vi.fn(() => PLAN_CONTENT);

    localTicketSeed(ctx, ctx.fromPath!, readFile);

    expect(ctx.ticket).toBeDefined();
    expect(ctx.ticket!.key).toBe('PROJ-42');
    expect(ctx.ticket!.title).toBe('Add dark mode');
  });

  it('derives slug from plan filename', () => {
    const ctx = makeCtx('.clancy/plans/my-feature-3.md');
    const localContent = PLAN_CONTENT.replace(
      '**Ticket:** [PROJ-42] Add dark mode',
      '**Source:** test\n**Row:** #3 — My feature',
    );
    const readFile = vi.fn(() => localContent);

    localTicketSeed(ctx, ctx.fromPath!, readFile);

    expect(ctx.ticket!.key).toBe('my-feature-3');
  });

  it('reads the file at ctx.fromPath', () => {
    const ctx = makeCtx('.clancy/plans/test.md');
    const readFile = vi.fn(() => PLAN_CONTENT);

    localTicketSeed(ctx, ctx.fromPath!, readFile);

    expect(readFile).toHaveBeenCalledWith('.clancy/plans/test.md');
  });

  it('sets parentInfo to none and blockers to None', () => {
    const ctx = makeCtx('plan.md');
    const readFile = vi.fn(() => PLAN_CONTENT);

    localTicketSeed(ctx, ctx.fromPath!, readFile);

    expect(ctx.ticket!.parentInfo).toBe('none');
    expect(ctx.ticket!.blockers).toBe('None');
  });
});
