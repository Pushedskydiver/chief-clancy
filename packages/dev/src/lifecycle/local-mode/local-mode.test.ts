import type { Board } from '@chief-clancy/core/types/board.js';

import { RunContext } from '~/d/pipeline/context.js';
import { describe, expect, it, vi } from 'vitest';

import {
  createLocalConfig,
  createNoopBoard,
  runLocalPreflight,
} from './local-mode.js';

// ─── createNoopBoard ─────────────────────────────────────────────────────────

describe('createNoopBoard', () => {
  it('satisfies the Board interface', () => {
    const board: Board = createNoopBoard();
    expect(board).toBeDefined();
  });

  it('ping returns ok: true', async () => {
    const board = createNoopBoard();
    await expect(board.ping()).resolves.toEqual({ ok: true });
  });

  it('validateInputs returns undefined', () => {
    const board = createNoopBoard();
    expect(board.validateInputs()).toBeUndefined();
  });

  it('fetchTicket returns undefined', async () => {
    const board = createNoopBoard();
    await expect(board.fetchTicket({})).resolves.toBeUndefined();
  });

  it('fetchTickets returns empty array', async () => {
    const board = createNoopBoard();
    await expect(board.fetchTickets({})).resolves.toEqual([]);
  });

  it('fetchBlockerStatus returns false', async () => {
    const board = createNoopBoard();
    const ticket = {
      key: 'X-1',
      title: 't',
      description: 'd',
      parentInfo: 'none',
      blockers: 'None',
    };
    await expect(board.fetchBlockerStatus(ticket)).resolves.toBe(false);
  });

  it('fetchChildrenStatus returns undefined', async () => {
    const board = createNoopBoard();
    await expect(board.fetchChildrenStatus('X-1')).resolves.toBeUndefined();
  });

  it('transitionTicket returns true', async () => {
    const board = createNoopBoard();
    const ticket = {
      key: 'X-1',
      title: 't',
      description: 'd',
      parentInfo: 'none',
      blockers: 'None',
    };
    await expect(board.transitionTicket(ticket, 'Done')).resolves.toBe(true);
  });

  it('ensureLabel resolves', async () => {
    const board = createNoopBoard();
    await expect(board.ensureLabel('label')).resolves.toBeUndefined();
  });

  it('addLabel resolves', async () => {
    const board = createNoopBoard();
    await expect(board.addLabel('X-1', 'label')).resolves.toBeUndefined();
  });

  it('removeLabel resolves', async () => {
    const board = createNoopBoard();
    await expect(board.removeLabel('X-1', 'label')).resolves.toBeUndefined();
  });

  it('sharedEnv returns empty object', () => {
    const board = createNoopBoard();
    expect(board.sharedEnv()).toEqual({});
  });
});

// ─── createLocalConfig ───────────────────────────────────────────────────────

describe('createLocalConfig', () => {
  it('uses shortcut provider', () => {
    const config = createLocalConfig();
    expect(config.provider).toBe('shortcut');
  });

  it('sets local-mode sentinel token', () => {
    const config = createLocalConfig();
    expect(config.env).toHaveProperty('SHORTCUT_API_TOKEN', 'local-mode');
  });

  it('defaults CLANCY_BASE_BRANCH to main', () => {
    const config = createLocalConfig();
    expect(config.env).toHaveProperty('CLANCY_BASE_BRANCH', 'main');
  });

  it('reads CLANCY_BASE_BRANCH from envFile when provided', () => {
    const config = createLocalConfig({
      envFile: { CLANCY_BASE_BRANCH: 'develop' },
    });
    expect(config.env).toHaveProperty('CLANCY_BASE_BRANCH', 'develop');
  });

  it('includes GITHUB_TOKEN from envFile when present', () => {
    const config = createLocalConfig({
      envFile: { GITHUB_TOKEN: 'ghp_abc123' },
    });
    expect(config.env).toHaveProperty('GITHUB_TOKEN', 'ghp_abc123');
  });

  it('includes GITLAB_TOKEN from envFile when present', () => {
    const config = createLocalConfig({
      envFile: { GITLAB_TOKEN: 'glpat_xyz' },
    });
    expect(config.env).toHaveProperty('GITLAB_TOKEN', 'glpat_xyz');
  });

  it('includes AZDO_PAT from envFile when present', () => {
    const config = createLocalConfig({ envFile: { AZDO_PAT: 'pat_test' } });
    expect(config.env).toHaveProperty('AZDO_PAT', 'pat_test');
  });

  it('includes BITBUCKET_USER from envFile when present', () => {
    const config = createLocalConfig({
      envFile: { BITBUCKET_USER: 'bb_user' },
    });
    expect(config.env).toHaveProperty('BITBUCKET_USER', 'bb_user');
  });

  it('includes BITBUCKET_TOKEN from envFile when present', () => {
    const config = createLocalConfig({
      envFile: { BITBUCKET_TOKEN: 'bb_tok' },
    });
    expect(config.env).toHaveProperty('BITBUCKET_TOKEN', 'bb_tok');
  });

  it('reads CLANCY_BASE_BRANCH from process.env when envFile omits it', () => {
    const original = process.env['CLANCY_BASE_BRANCH'];
    process.env['CLANCY_BASE_BRANCH'] = 'staging';
    try {
      const config = createLocalConfig({ envFile: {} });
      expect(config.env).toHaveProperty('CLANCY_BASE_BRANCH', 'staging');
    } finally {
      if (original === undefined) {
        delete process.env['CLANCY_BASE_BRANCH'];
      } else {
        process.env['CLANCY_BASE_BRANCH'] = original;
      }
    }
  });

  it('omits git tokens when not in envFile', () => {
    const config = createLocalConfig({ envFile: {} });
    expect(config.env).not.toHaveProperty('GITHUB_TOKEN');
    expect(config.env).not.toHaveProperty('GITLAB_TOKEN');
    expect(config.env).not.toHaveProperty('AZDO_PAT');
    expect(config.env).not.toHaveProperty('BITBUCKET_USER');
    expect(config.env).not.toHaveProperty('BITBUCKET_TOKEN');
  });

  it('omits git tokens when envFile is undefined', () => {
    const config = createLocalConfig();
    expect(config.env).not.toHaveProperty('GITHUB_TOKEN');
  });
});

// ─── runLocalPreflight ───────────────────────────────────────────────────────

describe('runLocalPreflight', () => {
  function makeCtx(): RunContext {
    return new RunContext({ projectRoot: '/repo', argv: [] });
  }

  it('sets ctx.config and ctx.board', () => {
    const ctx = makeCtx();
    const envFs = { readFile: vi.fn(() => 'GITHUB_TOKEN=ghp_test\n') };
    runLocalPreflight(ctx, { envFs, projectRoot: '/repo' });

    expect(ctx.config).toBeDefined();
    expect(ctx.board).toBeDefined();
  });

  it('uses shortcut provider in config', () => {
    const ctx = makeCtx();
    const envFs = { readFile: vi.fn(() => '') };
    runLocalPreflight(ctx, { envFs, projectRoot: '/repo' });

    expect(ctx.config!.provider).toBe('shortcut');
  });

  it('passes git tokens from .clancy/.env to config', () => {
    const ctx = makeCtx();
    const envFs = { readFile: vi.fn(() => 'GITHUB_TOKEN=ghp_fromenv\n') };
    runLocalPreflight(ctx, { envFs, projectRoot: '/repo' });

    expect(ctx.config!.env).toHaveProperty('GITHUB_TOKEN', 'ghp_fromenv');
  });

  it('handles missing .clancy/.env gracefully', () => {
    const ctx = makeCtx();
    const envFs = {
      readFile: vi.fn(() => {
        throw new Error('ENOENT');
      }),
    };
    runLocalPreflight(ctx, { envFs, projectRoot: '/repo' });

    expect(ctx.config).toBeDefined();
    expect(ctx.config!.provider).toBe('shortcut');
    expect(ctx.config!.env).not.toHaveProperty('GITHUB_TOKEN');
  });

  it('board is a no-op stub', async () => {
    const ctx = makeCtx();
    const envFs = {
      readFile: vi.fn(() => {
        throw new Error('ENOENT');
      }),
    };
    runLocalPreflight(ctx, { envFs, projectRoot: '/repo' });

    await expect(ctx.board!.ping()).resolves.toEqual({ ok: true });
    await expect(ctx.board!.transitionTicket({} as never, '')).resolves.toBe(
      true,
    );
    expect(ctx.board!.sharedEnv()).toEqual({});
  });
});
