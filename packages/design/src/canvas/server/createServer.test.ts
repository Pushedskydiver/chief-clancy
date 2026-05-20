import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  CanvasApiKeyError,
  resolveAnthropicApiKey,
  startCanvasServer,
} from './createServer.js';
import { acquireCanvasLock, CanvasLockError } from './lock.js';

describe('resolveAnthropicApiKey', () => {
  it('uses an explicit API key before ANTHROPIC_API_KEY', () => {
    const result = resolveAnthropicApiKey({
      explicitApiKey: ' flag-key ',
      env: { ANTHROPIC_API_KEY: 'env-key' },
    });

    expect(result).toEqual({ apiKey: 'flag-key', source: 'flag' });
  });

  it('uses ANTHROPIC_API_KEY when no explicit API key is passed', () => {
    const result = resolveAnthropicApiKey({
      env: { ANTHROPIC_API_KEY: ' env-key ' },
    });

    expect(result).toEqual({ apiKey: 'env-key', source: 'env' });
  });
});

describe('CanvasApiKeyError', () => {
  it('throws a clear startup error when no supported API-key source is present', () => {
    expect(() =>
      resolveAnthropicApiKey({ env: { ANTHROPIC_API_KEY: '   ' } }),
    ).toThrow(CanvasApiKeyError);
    expect(() => resolveAnthropicApiKey({ env: {} })).toThrow(
      'No Anthropic API key found',
    );
  });
});

describe('acquireCanvasLock', () => {
  it('writes a project-local lock file and returns a release hook that removes it', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'clancy-design-lock-'));

    const lock = await acquireCanvasLock({
      projectRoot,
      sessionId: 'session-123',
      pid: 12345,
      now: new Date('2026-05-18T10:00:00.000Z'),
    });

    const raw = await readFile(lock.lockPath, 'utf8');
    expect(JSON.parse(raw)).toEqual({
      pid: 12345,
      sessionId: 'session-123',
      startedAt: '2026-05-18T10:00:00.000Z',
    });

    await lock.release();
    await expect(readFile(lock.lockPath, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('does not remove a newer lock during an old async release', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'clancy-design-lock-'));
    const oldLock = await acquireCanvasLock({
      projectRoot,
      sessionId: 'old-session',
      pid: 12345,
      now: new Date('2026-05-18T10:00:00.000Z'),
    });

    oldLock.releaseSync();
    const freshLock = await acquireCanvasLock({
      projectRoot,
      sessionId: 'fresh-session',
      pid: 67890,
      now: new Date('2026-05-18T10:01:00.000Z'),
    });

    await oldLock.release();

    const raw = await readFile(freshLock.lockPath, 'utf8');
    expect(JSON.parse(raw)).toMatchObject({
      pid: 67890,
      sessionId: 'fresh-session',
    });
  });

  it('blocks when an existing lock points at a live process', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'clancy-design-lock-'));
    await acquireCanvasLock({
      projectRoot,
      sessionId: 'first-session',
      pid: 12345,
      now: new Date('2026-05-18T10:00:00.000Z'),
    });

    await expect(
      acquireCanvasLock({
        projectRoot,
        sessionId: 'second-session',
        processExists: () => true,
        now: new Date('2026-05-18T10:01:00.000Z'),
      }),
    ).rejects.toThrow(CanvasLockError);
  });

  it('blocks when the pid probe reports EPERM for an existing process', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'clancy-design-lock-'));
    await acquireCanvasLock({
      projectRoot,
      sessionId: 'first-session',
      pid: 12345,
      now: new Date('2026-05-18T10:00:00.000Z'),
    });
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('operation not permitted'), {
        code: 'EPERM',
      });
    });

    try {
      await expect(
        acquireCanvasLock({
          projectRoot,
          sessionId: 'second-session',
          now: new Date('2026-05-18T10:01:00.000Z'),
        }),
      ).rejects.toThrow(CanvasLockError);
    } finally {
      killSpy.mockRestore();
    }
  });

  it('blocks on an unrecognized lock payload instead of guessing it is stale', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'clancy-design-lock-'));
    const lock = await acquireCanvasLock({
      projectRoot,
      sessionId: 'first-session',
      pid: 12345,
      now: new Date('2026-05-18T10:00:00.000Z'),
    });
    await writeFile(
      lock.lockPath,
      JSON.stringify({
        pid: '12345',
        startedAt: '2026-05-18T10:00:00.000Z',
      }),
      'utf8',
    );

    await expect(
      acquireCanvasLock({
        projectRoot,
        sessionId: 'second-session',
        now: new Date('2026-05-18T10:01:00.000Z'),
        processExists: () => false,
      }),
    ).rejects.toThrow(CanvasLockError);
  });

  it('overwrites a lock older than 24 hours even if the old pid now exists', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'clancy-design-lock-'));
    await acquireCanvasLock({
      projectRoot,
      sessionId: 'old-session',
      pid: 12345,
      now: new Date('2026-05-17T09:59:59.000Z'),
    });

    const lock = await acquireCanvasLock({
      projectRoot,
      sessionId: 'fresh-session',
      pid: 67890,
      now: new Date('2026-05-18T10:00:00.000Z'),
      processExists: () => true,
    });

    const raw = await readFile(lock.lockPath, 'utf8');
    expect(JSON.parse(raw)).toMatchObject({
      pid: 67890,
      sessionId: 'fresh-session',
    });
  });

  it('overwrites a lock whose pid is no longer running', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'clancy-design-lock-'));
    await acquireCanvasLock({
      projectRoot,
      sessionId: 'dead-session',
      pid: 12345,
      now: new Date('2026-05-18T09:00:00.000Z'),
    });

    const lock = await acquireCanvasLock({
      projectRoot,
      sessionId: 'fresh-session',
      pid: 67890,
      now: new Date('2026-05-18T10:00:00.000Z'),
      processExists: () => false,
    });

    const raw = await readFile(lock.lockPath, 'utf8');
    expect(JSON.parse(raw)).toMatchObject({
      pid: 67890,
      sessionId: 'fresh-session',
    });
  });
});

describe('startCanvasServer', () => {
  it('starts a localhost Vite server, writes the lock, and releases both on close', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'clancy-design-server-'));
    let listened = false;
    let closed = false;

    const result = await startCanvasServer({
      projectRoot,
      sessionId: 'session-123',
      apiKey: 'test-key',
      createViteServer: async (config) => {
        expect(config.server).toMatchObject({
          host: '127.0.0.1',
          port: 4173,
          strictPort: false,
        });
        return {
          resolvedUrls: { local: ['http://127.0.0.1:4173/'] },
          listen: async () => {
            listened = true;
          },
          close: async () => {
            closed = true;
          },
        };
      },
      registerSignals: false,
    });

    expect(listened).toBe(true);
    expect(result.url).toBe('http://127.0.0.1:4173/');
    await expect(readFile(result.lockPath, 'utf8')).resolves.toContain(
      'session-123',
    );

    await result.close();
    expect(closed).toBe(true);
    await expect(readFile(result.lockPath, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('closes a created Vite server and releases the lock when listen fails', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'clancy-design-server-'));
    let closed = false;

    await expect(
      startCanvasServer({
        projectRoot,
        sessionId: 'session-123',
        apiKey: 'test-key',
        createViteServer: async () => ({
          listen: async () => {
            throw new Error('listen failed');
          },
          close: async () => {
            closed = true;
          },
        }),
        registerSignals: false,
      }),
    ).rejects.toThrow('listen failed');

    expect(closed).toBe(true);
    await expect(
      readFile(join(projectRoot, '.clancy', 'design', '.lock'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
