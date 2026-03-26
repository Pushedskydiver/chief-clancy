import { describe, expect, it, vi } from 'vitest';

import { buildPipelineDeps } from './dep-factory.js';

type DepFactoryOpts = Parameters<typeof buildPipelineDeps>[0];

// Mock shape — fs stubs don't match full FS interface types
function createMockOpts() {
  return {
    projectRoot: '/tmp/test',
    exec: vi.fn(),
    lockFs: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      deleteFile: vi.fn(),
      mkdir: vi.fn(),
    },
    progressFs: { readFile: vi.fn(), appendFile: vi.fn(), mkdir: vi.fn() },
    costFs: { readFile: vi.fn(), appendFile: vi.fn(), mkdir: vi.fn() },
    envFs: { readFile: vi.fn() },
    qualityFs: { readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn() },
    spawn: vi.fn(),
    fetch: vi.fn(),
  } as unknown as DepFactoryOpts & {
    exec: ReturnType<typeof vi.fn>;
    lockFs: { deleteFile: ReturnType<typeof vi.fn> };
    fetch: ReturnType<typeof vi.fn>;
  };
}

describe('buildPipelineDeps', () => {
  it('returns all PipelineDeps fields', () => {
    const deps = buildPipelineDeps(createMockOpts());

    expect(typeof deps.lockCheck).toBe('function');
    expect(typeof deps.preflight).toBe('function');
    expect(typeof deps.epicCompletion).toBe('function');
    expect(typeof deps.prRetry).toBe('function');
    expect(typeof deps.reworkDetection).toBe('function');
    expect(typeof deps.ticketFetch).toBe('function');
    expect(typeof deps.feasibility).toBe('function');
    expect(typeof deps.branchSetup).toBe('function');
    expect(typeof deps.transition).toBe('function');
    expect(typeof deps.invoke).toBe('function');
    expect(typeof deps.deliver).toBe('function');
    expect(typeof deps.cost).toBe('function');
    expect(typeof deps.cleanup).toBe('function');
    expect(typeof deps.checkout).toBe('function');
    expect(typeof deps.deleteLock).toBe('function');
    expect(typeof deps.deleteVerifyAttempt).toBe('function');
  });

  it('checkout delegates to exec with the branch', () => {
    const mockOpts = createMockOpts();
    const deps = buildPipelineDeps(mockOpts);

    deps.checkout('main');

    expect(mockOpts.exec).toHaveBeenCalledWith(
      expect.arrayContaining(['checkout', 'main']),
    );
  });

  it('deleteLock calls lockFs.deleteFile', () => {
    const mockOpts = createMockOpts();
    const deps = buildPipelineDeps(mockOpts);

    deps.deleteLock();

    expect(mockOpts.lockFs.deleteFile).toHaveBeenCalled();
  });

  it('deleteVerifyAttempt calls lockFs.deleteFile with distinct path from deleteLock', () => {
    const mockOpts = createMockOpts();
    const deps = buildPipelineDeps(mockOpts);

    deps.deleteLock();
    const lockPath = mockOpts.lockFs.deleteFile.mock.calls[0]![0] as string;

    mockOpts.lockFs.deleteFile.mockClear();
    deps.deleteVerifyAttempt();
    const verifyPath = mockOpts.lockFs.deleteFile.mock.calls[0]![0] as string;

    expect(lockPath).not.toBe(verifyPath);
  });

  it('cleanup wires sendNotification with fetch', async () => {
    const mockOpts = createMockOpts();
    mockOpts.fetch.mockResolvedValue({ ok: true } as Response);
    const deps = buildPipelineDeps(mockOpts);
    const ctx = {
      config: { env: { CLANCY_NOTIFY_WEBHOOK: 'https://hooks.slack.com/x' } },
      ticket: { key: 'T-1', title: 'Test' },
      startTime: Date.now(),
    };

    await deps.cleanup(ctx as never);

    expect(mockOpts.fetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/x',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('cost reads lock and appends entry', () => {
    const mockOpts = createMockOpts();
    const deps = buildPipelineDeps(mockOpts);
    const ctx = {
      config: { env: {} },
      ticket: { key: 'T-1', title: 'Test' },
      startTime: Date.now(),
    };

    deps.cost(ctx as never);

    expect(mockOpts.lockFs.readFile).toHaveBeenCalled();
  });
});
