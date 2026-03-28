/**
 * Integration test: GitHub board — full pipeline happy path.
 *
 * Exercises the complete 13-phase pipeline with:
 * - Real git operations (temp repo with bare remote)
 * - DI fetcher returning canned GitHub API responses
 * - Claude simulator for the invoke phase
 * - Real filesystem for lock/progress/cost/quality files
 *
 * Validates that the pipeline completes end-to-end and produces
 * the expected side effects (branches, lock cleanup, progress entries).
 */
import type {
  CostFs,
  EnvFileSystem,
  LockFs,
  PipelineDeps,
  PipelineResult,
  ProgressFs,
  QualityFs,
} from '@chief-clancy/core';

import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildPipelineDeps } from '~/t/runner/dep-factory/dep-factory.js';
import { afterEach, describe, expect, it } from 'vitest';

import { createContext, runPipeline } from '@chief-clancy/core';

import { createClaudeSimulator } from '../../helpers/claude-simulator.js';

// ─── GitHub API mock fetcher ─────────────────────────────────────────────────

const GITHUB_USER = { login: 'testuser' };
const GITHUB_ISSUE = {
  number: 42,
  title: 'Add widget feature',
  body: 'Implement the widget.\n\nEpic: #10',
  state: 'open',
  assignee: { login: 'testuser' },
  milestone: null,
  labels: [{ name: 'clancy' }],
  pull_request: undefined,
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Route definitions for the GitHub mock fetcher. */
const ROUTES: ReadonlyArray<{
  readonly method: string;
  readonly pattern: RegExp;
  readonly respond: () => Response;
}> = [
  {
    method: 'GET',
    pattern: /\/user$/,
    respond: () => jsonResponse(GITHUB_USER),
  },
  {
    method: 'GET',
    pattern: /\/repos\/[^/]+\/[^/]+$/,
    respond: () => jsonResponse({ id: 1 }),
  },
  {
    method: 'GET',
    pattern: /\/repos\/[^/]+\/[^/]+\/issues\?/,
    respond: () => jsonResponse([GITHUB_ISSUE]),
  },
  {
    method: 'GET',
    pattern: /\/labels\//,
    respond: () => jsonResponse({ name: 'clancy' }),
  },
  {
    method: 'POST',
    pattern: /\/labels$/,
    respond: () => jsonResponse({ name: 'clancy' }, 201),
  },
  {
    method: 'DELETE',
    pattern: /\/labels\//,
    respond: () => jsonResponse([], 200),
  },
  {
    method: 'POST',
    pattern: /\/pulls$/,
    respond: () =>
      jsonResponse(
        { number: 1, html_url: 'https://github.com/test/pull/1' },
        201,
      ),
  },
  {
    method: 'GET',
    pattern: /\/search\/issues/,
    respond: () => jsonResponse({ total_count: 0, items: [] }),
  },
  {
    method: 'PATCH',
    pattern: /\/issues\/\d+$/,
    respond: () => jsonResponse({ state: 'closed' }),
  },
];

function createGitHubFetcher() {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    const method = init?.method ?? 'GET';
    const match = ROUTES.find(
      (r) => r.method === method && r.pattern.test(url),
    );
    return match?.respond() ?? new Response('Not Found', { status: 404 });
  };
}

// ─── Filesystem helpers ──────────────────────────────────────────────────────

function createRealFs() {
  const lockFs: LockFs = {
    readFile: (p) => readFileSync(p, 'utf8'),
    writeFile: (p, c) => {
      mkdirSync(join(p, '..'), { recursive: true });
      writeFileSync(p, c);
    },
    deleteFile: (p) => {
      try {
        rmSync(p);
      } catch {
        /* ignore */
      }
    },
    mkdir: (p) => mkdirSync(p, { recursive: true }),
  };

  const progressFs: ProgressFs = {
    readFile: (p) => {
      try {
        return readFileSync(p, 'utf8');
      } catch {
        return '';
      }
    },
    appendFile: (p, c) => {
      mkdirSync(join(p, '..'), { recursive: true });
      appendFileSync(p, c);
    },
    mkdir: (p) => mkdirSync(p, { recursive: true }),
  };

  const costFs: CostFs = {
    appendFile: (p, c) => {
      mkdirSync(join(p, '..'), { recursive: true });
      appendFileSync(p, c);
    },
    mkdir: (p) => mkdirSync(p, { recursive: true }),
  };

  const qualityFs: QualityFs = {
    readFile: (p) => {
      try {
        return readFileSync(p, 'utf8');
      } catch {
        return '{}';
      }
    },
    writeFile: (p, c) => {
      mkdirSync(join(p, '..'), { recursive: true });
      writeFileSync(p, c);
    },
    rename: (from, to) => renameSync(from, to),
    mkdir: (p) => mkdirSync(p, { recursive: true }),
  };

  const envFs: EnvFileSystem = {
    exists: existsSync,
    readFile: (p) => readFileSync(p, 'utf8'),
  };

  return { lockFs, progressFs, costFs, qualityFs, envFs };
}

// ─── Temp repo with bare remote ──────────────────────────────────────────────

function createRepoWithRemote() {
  const base = mkdtempSync(join(tmpdir(), 'clancy-pipeline-'));
  const bareDir = join(base, 'remote.git');
  const workDir = join(base, 'work');

  mkdirSync(bareDir);
  execFileSync('git', ['init', '--bare', '-b', 'main'], {
    cwd: bareDir,
    stdio: 'pipe',
  });

  mkdirSync(workDir);
  execFileSync('git', ['init', '-b', 'main'], { cwd: workDir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@clancy.dev'], {
    cwd: workDir,
    stdio: 'pipe',
  });
  execFileSync('git', ['config', 'user.name', 'Clancy Test'], {
    cwd: workDir,
    stdio: 'pipe',
  });
  execFileSync('git', ['remote', 'add', 'origin', bareDir], {
    cwd: workDir,
    stdio: 'pipe',
  });

  writeFileSync(join(workDir, 'README.md'), '# Test');
  execFileSync('git', ['add', '.'], { cwd: workDir, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'initial commit'], {
    cwd: workDir,
    stdio: 'pipe',
  });
  execFileSync('git', ['push', '-u', 'origin', 'main'], {
    cwd: workDir,
    stdio: 'pipe',
  });

  const clancyDir = join(workDir, '.clancy');
  mkdirSync(clancyDir, { recursive: true });
  writeFileSync(
    join(clancyDir, '.env'),
    [
      'GITHUB_TOKEN="ghp_test"',
      'GITHUB_REPO="test-org/test-repo"',
      'CLANCY_LABEL="clancy"',
    ].join('\n'),
  );

  // Dual-mode exec: the dep factory's preflight wiring calls
  // (file, args) => exec([file, ...args]), so the first arg may be
  // a binary name (claude, git) or a git subcommand (rev-parse, etc.).
  // Stub `claude` so preflight passes even when Claude isn't installed (CI).
  const STUBBED_BINARIES: Record<string, string> = { claude: '1.0.0 (stub)' };
  const REAL_BINARIES = new Set(['git', 'node', 'pnpm', 'npm']);
  const exec = (args: readonly string[]) => {
    if (args[0] in STUBBED_BINARIES) return STUBBED_BINARIES[args[0]];
    const isReal = REAL_BINARIES.has(args[0]);
    const cmd = isReal ? args[0] : 'git';
    const cmdArgs = isReal ? args.slice(1) : args;
    return execFileSync(cmd, cmdArgs, {
      cwd: workDir,
      stdio: 'pipe',
      encoding: 'utf8',
    });
  };

  const cleanup = () => rmSync(base, { recursive: true, force: true });

  return { workDir, exec, cleanup };
}

// ─── Shared test setup ───────────────────────────────────────────────────────

type PipelineSetup = {
  readonly repo: ReturnType<typeof createRepoWithRemote>;
  readonly deps: PipelineDeps;
  readonly run: (argv?: readonly string[]) => Promise<PipelineResult>;
};

/** Set up a full pipeline with default happy-path configuration. */
function setupPipeline(overrides?: {
  readonly exitCode?: number;
  readonly fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
}): PipelineSetup {
  const repo = createRepoWithRemote();
  const sim = createClaudeSimulator({ exitCode: overrides?.exitCode ?? 0 });
  const fetcher = overrides?.fetcher ?? createGitHubFetcher();
  const fs = createRealFs();

  const deps = buildPipelineDeps({
    projectRoot: repo.workDir,
    exec: repo.exec,
    lockFs: fs.lockFs,
    progressFs: fs.progressFs,
    costFs: fs.costFs,
    envFs: fs.envFs,
    qualityFs: fs.qualityFs,
    spawn: sim.spawn,
    fetch: fetcher,
  });

  const run = (argv: readonly string[] = []) => {
    const ctx = createContext({ projectRoot: repo.workDir, argv });
    return runPipeline(ctx, deps);
  };

  return { repo, deps, run };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe('GitHub pipeline — happy path', () => {
  it('completes the full 13-phase pipeline', async () => {
    const { repo, run } = setupPipeline();
    cleanup = repo.cleanup;

    const result = await run();

    expect(result.status).toBe('completed');
  });

  it('creates a ticket branch during branch setup', async () => {
    const { repo, run } = setupPipeline();
    cleanup = repo.cleanup;

    await run();

    // GitHub ticket #42 → branch feature/issue-42
    const branches = repo.exec(['branch', '--list']).trim();
    expect(branches).toContain('feature/issue-42');
  });

  it('cleans up lock file after completion', async () => {
    const { repo, run } = setupPipeline();
    cleanup = repo.cleanup;

    await run();

    const lockPath = join(repo.workDir, '.clancy', 'lock.json');
    expect(existsSync(lockPath)).toBe(false);
  });

  it('appends progress entry on completion', async () => {
    const { repo, run } = setupPipeline();
    cleanup = repo.cleanup;

    await run();

    const progressPath = join(repo.workDir, '.clancy', 'progress.txt');
    expect(existsSync(progressPath)).toBe(true);

    const content = readFileSync(progressPath, 'utf8');
    expect(content).toContain('#42');
  });

  it('returns dry-run status with --dry-run flag', async () => {
    const { repo, run } = setupPipeline();
    cleanup = repo.cleanup;

    const result = await run(['--dry-run']);

    expect(result.status).toBe('dry-run');
  });

  it('aborts at preflight when env is missing', async () => {
    const { repo, run } = setupPipeline();
    cleanup = repo.cleanup;

    rmSync(join(repo.workDir, '.clancy', '.env'));

    const result = await run();

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('preflight');
  });

  it('aborts at ticket-fetch when board returns no issues', async () => {
    const baseFetcher = createGitHubFetcher();
    const emptyFetcher = async (url: string, init?: RequestInit) => {
      if (/\/issues\?/.test(url) && (init?.method ?? 'GET') === 'GET') {
        return jsonResponse([]);
      }
      return baseFetcher(url, init);
    };

    const { repo, run } = setupPipeline({ fetcher: emptyFetcher });
    cleanup = repo.cleanup;

    const result = await run();

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('ticket-fetch');
  });

  it('aborts at invoke when Claude exits non-zero', async () => {
    const { repo, run } = setupPipeline({ exitCode: 1 });
    cleanup = repo.cleanup;

    const result = await run();

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('invoke');
  });
});
