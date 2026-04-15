import type { RunContext } from '../pipeline/context.js';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { wireDeliver } from './deliver-phase.js';

vi.mock('@chief-clancy/core', () => ({
  detectRemote: vi.fn(() => ({
    owner: 'org',
    repo: 'repo',
    host: 'github.com',
  })),
}));

vi.mock('../pipeline/phases/deliver-phase.js', () => ({
  deliverPhase: vi.fn((_ctx: unknown, deps: unknown) => deps),
}));

vi.mock('../lifecycle/deliver-ticket/deliver-ticket.js', () => ({
  deliverViaPullRequest: vi.fn(),
}));

vi.mock('../lifecycle/quality/quality.js', () => ({
  recordDelivery: vi.fn(),
  recordRework: vi.fn(),
}));

vi.mock('../lifecycle/rework/rework.js', () => ({
  postReworkActions: vi.fn(),
}));

vi.mock('../lifecycle/rework/rework-handlers.js', () => ({
  resolvePlatformHandlers: vi.fn(() => undefined),
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
    const { deliverViaPullRequest } =
      await import('../lifecycle/deliver-ticket/deliver-ticket.js');
    const result = wireDeliver(createOpts(), vi.fn());
    const deps = await result.deliver(createCtx());

    // Call the wired function to verify it delegates
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
    const { recordDelivery } = await import('../lifecycle/quality/quality.js');
    const result = wireDeliver(createOpts(), vi.fn());
    const deps = await result.deliver(createCtx());

    (
      deps as unknown as Record<string, (...args: unknown[]) => unknown>
    ).recordDelivery();

    expect(recordDelivery).toHaveBeenCalledWith(
      expect.anything(),
      '/tmp/test',
      expect.objectContaining({ ticketKey: 'GH-1' }),
    );
  });

  it('recordRework calls core recordRework with ticket key', async () => {
    const { recordRework } = await import('../lifecycle/quality/quality.js');
    const result = wireDeliver(createOpts(), vi.fn());
    const deps = await result.deliver(createCtx());

    (
      deps as unknown as Record<string, (...args: unknown[]) => unknown>
    ).recordRework();

    expect(recordRework).toHaveBeenCalledWith(
      expect.anything(),
      '/tmp/test',
      'GH-1',
    );
  });

  it('postReworkActions returns early when no platform handlers', async () => {
    const { postReworkActions } = await import('../lifecycle/rework/rework.js');
    const result = wireDeliver(createOpts(), vi.fn());
    const deps = await result.deliver(createCtx());

    await (
      deps as unknown as Record<string, (...args: unknown[]) => unknown>
    ).postReworkActions({});

    expect(postReworkActions).not.toHaveBeenCalled();
  });

  it('postReworkActions delegates when platform handlers are resolved', async () => {
    const { resolvePlatformHandlers } =
      await import('../lifecycle/rework/rework-handlers.js');
    const { postReworkActions } = await import('../lifecycle/rework/rework.js');
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
