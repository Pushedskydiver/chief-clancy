/**
 * E2E spawn test for `clancy:design canvas` — Phase F slice 12 spec cell:
 * "spawn, assert listening on port; kill, assert lock cleared."
 *
 * Spawns the package's bin script as a child process against a temp project
 * root. Reserves a free localhost port before spawning, avoiding cross-test
 * contention while still exercising Vite's real listener.
 */
import { spawn } from 'node:child_process';
import {
  access,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN_PATH = join(PACKAGE_ROOT, 'bin', 'design.js');
const LOCK_PATH = join('.clancy', 'design', '.lock');

type RunningChild = {
  readonly stdout: () => string;
  readonly stderr: () => string;
  readonly close: Promise<number | null>;
  readonly kill: (signal: NodeJS.Signals) => void;
};

const createTempProject = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'clancy-design-e2e-canvas-'));
  await writeFile(
    join(root, 'index.html'),
    '<div>canvas fixture</div>',
    'utf8',
  );
  return root;
};

const findFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createNetServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('failed to reserve a TCP port')));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });

const spawnCanvas = (cwd: string, port: number): RunningChild => {
  const child = spawn(
    'node',
    [BIN_PATH, 'canvas', '--api-key', 'test-key', '--port', String(port)],
    { cwd },
  );
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
  child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
  return {
    stdout: () => Buffer.concat(stdoutChunks).toString('utf8'),
    stderr: () => Buffer.concat(stderrChunks).toString('utf8'),
    close: new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    }),
    kill: (signal) => {
      child.kill(signal);
    },
  };
};

const waitFor = async (
  predicate: () => boolean,
  describeFailure: () => string,
  close: Promise<number | null>,
): Promise<void> => {
  const deadline = Date.now() + 5_000;
  const waitForPredicate = async (): Promise<'ready' | 'timeout'> => {
    if (predicate()) return 'ready';
    if (Date.now() >= deadline) return 'timeout';
    await new Promise((resolve) => setTimeout(resolve, 25));
    return waitForPredicate();
  };
  const outcome = await Promise.race([
    waitForPredicate(),
    close.then((code) => `closed:${code}` as const),
  ]);
  if (outcome === 'ready') return;
  if (outcome.startsWith('closed:')) {
    throw new Error(`child exited before condition passed: ${outcome}`);
  }
  throw new Error(describeFailure());
};

const extractLocalUrl = (stdout: string): string | null =>
  /http:\/\/127\.0\.0\.1:\d+\//.exec(stdout)?.[0] ?? null;

describe('bin/design.js canvas (E2E)', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await createTempProject();
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('starts Vite, writes a lock, responds on localhost, and clears the lock on SIGTERM', async () => {
    const port = await findFreePort();
    const child = spawnCanvas(projectRoot, port);
    const lockPath = join(projectRoot, LOCK_PATH);

    try {
      await waitFor(
        () => extractLocalUrl(child.stdout()) !== null,
        () =>
          `canvas did not print a localhost URL.\nstderr:\n${child.stderr()}`,
        child.close,
      );
      const url = extractLocalUrl(child.stdout());
      if (url === null)
        throw new Error(`missing URL in stdout: ${child.stdout()}`);

      const lockStat = await stat(lockPath);
      expect(lockStat.isFile()).toBe(true);
      expect(await readFile(lockPath, 'utf8')).toContain('"sessionId"');

      const response = await fetch(url);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    } finally {
      child.kill('SIGTERM');
      await child.close;
    }

    await expect(access(lockPath)).rejects.toMatchObject({ code: 'ENOENT' });
  }, 15_000);
});
