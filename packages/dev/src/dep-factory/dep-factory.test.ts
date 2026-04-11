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
    buildPrompt: vi.fn(),
    buildReworkPrompt: vi.fn(),
  } as unknown as DepFactoryOpts & {
    exec: ReturnType<typeof vi.fn>;
    lockFs: { deleteFile: ReturnType<typeof vi.fn> };
    progressFs: { readFile: ReturnType<typeof vi.fn> };
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
    const lockPath = mockOpts.lockFs.deleteFile.mock.calls[0][0] as string;

    mockOpts.lockFs.deleteFile.mockClear();
    deps.deleteVerifyAttempt();
    const verifyPath = mockOpts.lockFs.deleteFile.mock.calls[0][0] as string;

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

  it('prRetry retryEntry calls fetch to create PR for pushed entry', async () => {
    const mockOpts = createMockOpts();

    // progressFs returns a PUSHED entry (no matching PR_CREATED)
    const pushedLine = '2026-03-27 10:00 | PROJ-1 | Fix login | PUSHED';
    mockOpts.progressFs.readFile.mockReturnValue(pushedLine);

    // exec returns github remote URL for detectRemote (git remote get-url origin)
    mockOpts.exec.mockReturnValue(
      'https://github.com/test-owner/test-repo.git',
    );

    // fetch returns a successful PR creation response
    mockOpts.fetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ html_url: 'https://github.com/x/1', number: 1 }),
    } as unknown as Response);

    const deps = buildPipelineDeps(mockOpts);
    const ctx = {
      config: {
        provider: 'github',
        env: {
          CLANCY_BASE_BRANCH: 'main',
          GITHUB_TOKEN: 'ghp_test123456789012345678901234567890',
        },
      },
    };

    await deps.prRetry(ctx as never);

    expect(mockOpts.fetch).toHaveBeenCalledWith(
      expect.stringContaining('github.com'),
      expect.objectContaining({ method: 'POST' }),
    );

    const callBody = JSON.parse(
      (mockOpts.fetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(callBody.title).toBe('feat(PROJ-1): Fix login');
    expect(callBody.head).toContain('PROJ-1');
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
