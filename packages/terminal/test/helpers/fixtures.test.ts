import { describe, expect, it } from 'vitest';

import { makeBoard, makeBoardConfig, makeCtx } from './fixtures.js';

describe('shared test fixtures', () => {
  it('makeBoard returns a stub with all Board methods as mock functions', () => {
    const board = makeBoard();

    expect(board.fetchTicket).toEqual(expect.any(Function));
    expect(board.fetchTickets).toEqual(expect.any(Function));
    expect(board.fetchChildrenStatus).toEqual(expect.any(Function));
    expect(board.fetchBlockerStatus).toEqual(expect.any(Function));
    expect(board.transitionTicket).toEqual(expect.any(Function));
    expect(board.addLabel).toEqual(expect.any(Function));
    expect(board.removeLabel).toEqual(expect.any(Function));
    expect(board.ensureLabel).toEqual(expect.any(Function));
    expect(board.validateInputs).toEqual(expect.any(Function));
    expect(board.ping).toEqual(expect.any(Function));
    expect(board.sharedEnv).toEqual(expect.any(Function));
  });

  it('makeBoardConfig builds valid config for each provider', () => {
    const github = makeBoardConfig('github');
    expect(github.provider).toBe('github');
    expect(github.env.GITHUB_TOKEN).toBe('ghp_test');

    const jira = makeBoardConfig('jira');
    expect(jira.provider).toBe('jira');
    expect(jira.env.JIRA_BASE_URL).toBe('https://jira.test');

    const linear = makeBoardConfig('linear');
    expect(linear.provider).toBe('linear');
    expect(linear.env.LINEAR_API_KEY).toBe('lin_test');

    const shortcut = makeBoardConfig('shortcut');
    expect(shortcut.provider).toBe('shortcut');
    expect(shortcut.env.SHORTCUT_API_TOKEN).toBe('sc_test');

    const notion = makeBoardConfig('notion');
    expect(notion.provider).toBe('notion');
    expect(notion.env.NOTION_TOKEN).toBe('ntn_test');

    const azdo = makeBoardConfig('azdo');
    expect(azdo.provider).toBe('azdo');
    expect(azdo.env.AZDO_ORG).toBe('test-org');
  });

  it('makeBoardConfig accepts env overrides', () => {
    const config = makeBoardConfig('github', { GITHUB_TOKEN: 'custom' });

    expect(config.env.GITHUB_TOKEN).toBe('custom');
  });

  it('makeCtx returns a RunContext with preflight populated', () => {
    const ctx = makeCtx();

    expect(ctx.config.provider).toBe('github');
    expect(ctx.board.fetchTicket).toEqual(expect.any(Function));
    expect(ctx.projectRoot).toBe('/repo');
  });

  it('makeCtx accepts provider overrides', () => {
    const ctx = makeCtx({ provider: 'jira' });

    expect(ctx.config.provider).toBe('jira');
    expect(ctx.config.env.JIRA_BASE_URL).toBe('https://jira.test');
  });
});
