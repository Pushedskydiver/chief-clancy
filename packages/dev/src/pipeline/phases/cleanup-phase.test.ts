import type { CleanupDeps } from './cleanup-phase.js';

import { describe, expect, it, vi } from 'vitest';

import { cleanupPhase } from './cleanup-phase.js';
import { makeCtx } from './test-helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDeps(overrides: Partial<CleanupDeps> = {}): CleanupDeps {
  return {
    notify: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('cleanupPhase', () => {
  it('returns ok: true with ticket key and elapsed time', async () => {
    const ctx = makeCtx();
    ctx.setTicket({
      key: 'PROJ-1',
      title: 'Test ticket',
      description: '',
      parentInfo: 'none',
      blockers: 'None',
    });

    const result = await cleanupPhase(ctx, makeDeps());

    expect(result.ok).toBe(true);
    expect(result.ticketKey).toBe('PROJ-1');
    expect(result.ticketTitle).toBe('Test ticket');
    expect(typeof result.elapsedMs).toBe('number');
  });

  it('calls notify when CLANCY_NOTIFY_WEBHOOK is set', async () => {
    const ctx = makeCtx({
      configEnv: { CLANCY_NOTIFY_WEBHOOK: 'https://hook.example.com' },
    });
    ctx.setTicket({
      key: 'PROJ-2',
      title: 'Notified ticket',
      description: '',
      parentInfo: 'none',
      blockers: 'None',
    });

    const deps = makeDeps();
    await cleanupPhase(ctx, deps);

    expect(deps.notify).toHaveBeenCalledOnce();
    expect(deps.notify).toHaveBeenCalledWith(
      'https://hook.example.com',
      '✓ Clancy completed [PROJ-2] Notified ticket',
    );
  });

  it('does not call notify when webhook is missing', async () => {
    const ctx = makeCtx();
    ctx.setTicket({
      key: 'PROJ-3',
      title: 'Silent ticket',
      description: '',
      parentInfo: 'none',
      blockers: 'None',
    });

    const deps = makeDeps();
    await cleanupPhase(ctx, deps);

    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('returns ok: true even when notify throws', async () => {
    const ctx = makeCtx({
      configEnv: { CLANCY_NOTIFY_WEBHOOK: 'https://hook.example.com' },
    });
    ctx.setTicket({
      key: 'PROJ-4',
      title: 'Error ticket',
      description: '',
      parentInfo: 'none',
      blockers: 'None',
    });

    const deps = makeDeps({
      notify: vi.fn().mockRejectedValue(new Error('network error')),
    });
    const result = await cleanupPhase(ctx, deps);

    expect(result.ok).toBe(true);
  });
});
