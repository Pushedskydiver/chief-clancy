import type { RunContext } from '@chief-clancy/core';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { wireDeliver } from './deliver-phase.js';

vi.mock('@chief-clancy/core', () => ({
  deliverPhase: vi.fn((_ctx: unknown, deps: unknown) => deps),
  detectRemote: vi.fn(() => ({
    owner: 'org',
    repo: 'repo',
    host: 'github.com',
  })),
}));

vi.mock('@chief-clancy/dev', () => ({
  deliverViaPullRequest: vi.fn(),
  recordDelivery: vi.fn(),
  recordRework: vi.fn(),
  resolvePlatformHandlers: vi.fn(() => undefined),
  postReworkActions: vi.fn(),
}));

type DeliverOpts = Parameters<typeof wireDeliver>[0];

function createOpts(): DeliverOpts {
  return {
    projectRoot: '/tmp/test',
    exec: vi.fn() as unknown as DeliverOpts['exec'],
    progressFs: {
      readFile: vi.fn(),
      appendFile: vi.fn(),
      mkdir: vi.fn(),
    } as unknown as DeliverOpts['progressFs'],
    qualityFs: {
      readFile: vi.fn(() => '{}'),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    } as unknown as DeliverOpts['qualityFs'],
    fetch: vi.fn() as unknown as DeliverOpts['fetch'],
  };
}

function createCtx(overrides: Record<string, unknown> = {}): RunContext {
  return {
    config: {
      provider: 'github',
      env: { CLANCY_NOTIFY_WEBHOOK: '' },
    },
    ticket: { key: 'GH-1', title: 'Test', issueId: '1' },
    startTime: 1000,
    ...overrides,
  } as unknown as RunContext;
}

describe('wireDeliver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an object with a deliver function', () => {
    const result = wireDeliver(createOpts(), vi.fn());

    expect(typeof result.deliver).toBe('function');
  });

  it('passes appendProgress through to deliverPhase deps', async () => {
    const progress = vi.fn();
    const result = wireDeliver(createOpts(), progress);
    const deps = await result.deliver(createCtx());

    expect(deps).toHaveProperty('appendProgress', progress);
  });

  it('wires deliverViaPullRequest with exec, fetchFn, and projectRoot', async () => {
    const opts = createOpts();
    const result = wireDeliver(opts, vi.fn());
    const deps = await result.deliver(createCtx());

    // Call the wired function to verify it delegates
    const { deliverViaPullRequest } = await import('@chief-clancy/dev');
    (
      deps as unknown as Record<string, (...args: unknown[]) => unknown>
    ).deliverViaPullRequest({ base: 'main' });

    expect(deliverViaPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        base: 'main',
        projectRoot: '/tmp/test',
      }),
    );
  });

  it('recordDelivery calls core recordDelivery with ticket key', async () => {
    const result = wireDeliver(createOpts(), vi.fn());
    const deps = await result.deliver(createCtx());

    (
      deps as unknown as Record<string, (...args: unknown[]) => unknown>
    ).recordDelivery();

    const { recordDelivery } = await import('@chief-clancy/dev');
    expect(recordDelivery).toHaveBeenCalledWith(
      expect.anything(),
      '/tmp/test',
      expect.objectContaining({ ticketKey: 'GH-1' }),
    );
  });

  it('recordRework calls core recordRework with ticket key', async () => {
    const result = wireDeliver(createOpts(), vi.fn());
    const deps = await result.deliver(createCtx());

    (
      deps as unknown as Record<string, (...args: unknown[]) => unknown>
    ).recordRework();

    const { recordRework } = await import('@chief-clancy/dev');
    expect(recordRework).toHaveBeenCalledWith(
      expect.anything(),
      '/tmp/test',
      'GH-1',
    );
  });

  it('postReworkActions returns early when no platform handlers', async () => {
    const result = wireDeliver(createOpts(), vi.fn());
    const deps = await result.deliver(createCtx());

    await (
      deps as unknown as Record<string, (...args: unknown[]) => unknown>
    ).postReworkActions({});

    const { postReworkActions } = await import('@chief-clancy/dev');
    expect(postReworkActions).not.toHaveBeenCalled();
  });

  it('postReworkActions delegates when platform handlers are resolved', async () => {
    const { resolvePlatformHandlers, postReworkActions } =
      await import('@chief-clancy/dev');
    const mockHandlers = { createPr: vi.fn() };
    vi.mocked(resolvePlatformHandlers).mockReturnValueOnce(
      mockHandlers as never,
    );

    const result = wireDeliver(createOpts(), vi.fn());
    const deps = await result.deliver(createCtx());

    await (
      deps as unknown as Record<string, (...args: unknown[]) => unknown>
    ).postReworkActions({
      prNumber: 42,
    });

    expect(postReworkActions).toHaveBeenCalledWith(
      expect.objectContaining({
        prNumber: 42,
        handlers: mockHandlers,
      }),
    );
  });
});
