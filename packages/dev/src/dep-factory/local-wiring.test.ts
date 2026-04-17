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
    execCmd: vi.fn(() => ''),
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
      execCmd: vi.fn(() => ''),
      fetch: vi.fn(),
    });
    const ctx = makeCtx('plan.md');
    const result = await notGitPreflight(ctx);
    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('Not inside a git repository'),
      },
    });
  });
});

// ─── wirePreflight (board path) ─────────────────────────────────────────────

describe('wirePreflight (board path) — exec vs execCmd separation', () => {
  it('routes preflight binary probes through execCmd, NOT exec', async () => {
    // Regression guard for PR-β Copilot F1: runPreflightTagged used to wrap
    // ExecGit (git-only) into an arbitrary-binary shim, so `claude --version`
    // became `git claude --version`. Now execCmd is a first-class dep.
    const probed: string[] = [];
    const exec = vi.fn(() => '');
    const execCmd = vi.fn((file: string) => {
      probed.push(file);
      // Fail preflight fast by throwing on the first binary probe — we just
      // want to confirm that probing reached execCmd at all, not exec.
      throw new Error('binary not found');
    });
    const envFs = { readFile: vi.fn(() => '') };

    const preflight = wirePreflight({
      envFs,
      projectRoot: '/repo',
      exec,
      execCmd,
      fetch: vi.fn(),
    });

    const ctx = new RunContext({ projectRoot: '/repo', argv: [] });
    const result = await preflight(ctx);

    expect(result.ok).toBe(false);
    // The binary probe MUST have hit execCmd with the binary name as the
    // file argument. If exec were still being wrapped, execCmd would never
    // be called and the test would catch the regression.
    expect(probed).toContain('claude');
    expect(execCmd).toHaveBeenCalledWith('claude', ['--version']);
    expect(exec).not.toHaveBeenCalled();
  });
});

// ─── localTicketSeed ─────────────────────────────────────────────────────────

describe('localTicketSeed', () => {
  it('sets ctx.ticket from plan file content and returns ok: true', () => {
    const ctx = makeCtx('.clancy/plans/add-dark-mode-1.md');
    const readFile = vi.fn(() => PLAN_CONTENT);

    const result = localTicketSeed(ctx, ctx.fromPath!, readFile);

    expect(result).toEqual({ ok: true });
    expect(ctx.ticket).toBeDefined();
    expect(ctx.ticket!.key).toBe('PROJ-42');
    expect(ctx.ticket!.title).toBe('Add dark mode');
  });

  it('returns tagged failure Result when plan file is malformed', () => {
    const ctx = makeCtx('.clancy/plans/broken.md');
    const readFile = vi.fn(() => '# Not a plan');

    const result = localTicketSeed(ctx, ctx.fromPath!, readFile);

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('.clancy/plans/broken.md'),
      },
    });
    expect(ctx.ticket).toBeUndefined();
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
