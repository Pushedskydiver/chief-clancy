/**
 * Shared helpers for pipeline integration tests.
 *
 * Extracts the reusable infrastructure from the GitHub happy-path test:
 * - {@link createRealFs} — real filesystem adapters for lock/progress/cost/quality/env
 * - {@link createRepoWithRemote} — temp git repo with bare remote and `.clancy/.env`
 * - {@link setupPipeline} — full pipeline wiring with configurable overrides
 */
import type { SimulatorResponse } from '../../helpers/claude-simulator.js';
import type { EnvFileSystem } from '@chief-clancy/core';
import type {
  CostFs,
  LockFs,
  PipelineResult,
  ProgressFs,
  QualityFs,
} from '@chief-clancy/dev';

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

import {
  buildPrompt,
  buildReworkPrompt,
} from '~/t/runner/prompt-builder/index.js';

import {
  buildPipelineDeps,
  createContext,
  runPipeline,
} from '@chief-clancy/dev';

import { createClaudeSimulator } from '../../helpers/claude-simulator.js';

// ─── Real filesystem adapters ────────────────────────────────────────────────

type RealFs = {
  readonly lockFs: LockFs;
  readonly progressFs: ProgressFs;
  readonly costFs: CostFs;
  readonly qualityFs: QualityFs;
  readonly envFs: EnvFileSystem;
};

/** Create real filesystem adapters for all pipeline I/O. */
function createRealFs(): RealFs {
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

type RepoWithRemote = {
  readonly workDir: string;
  readonly exec: (args: readonly string[]) => string;
  readonly cleanup: () => void;
};

/**
 * Create a temp git repo with a bare remote and `.clancy/.env`.
 *
 * @param envVars - Key-value pairs to write into `.clancy/.env`.
 * @returns The working directory, exec helper, and cleanup function.
 */
function createRepoWithRemote(envVars: Record<string, string>): RepoWithRemote {
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
  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}="${value}"`)
    .join('\n');
  writeFileSync(join(clancyDir, '.env'), envContent);

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

// ─── Pipeline setup ──────────────────────────────────────────────────────────

export type PipelineSetup = {
  readonly repo: RepoWithRemote;
  readonly run: (argv?: readonly string[]) => Promise<PipelineResult>;
};

type SetupOpts = {
  readonly envVars: Record<string, string>;
  readonly fetcher: (url: string, init?: RequestInit) => Promise<Response>;
  readonly exitCode?: number;
  /** Ordered per-call overrides for the Claude simulator. */
  readonly simulatorResponses?: readonly SimulatorResponse[];
};

/**
 * Set up a full pipeline with the given board configuration.
 *
 * @param opts - Env vars, mock fetcher, optional Claude exit code, and optional per-call simulator responses.
 * @returns Repo handle, wired deps, and a run function.
 */
export function setupPipeline(opts: SetupOpts): PipelineSetup {
  const repo = createRepoWithRemote(opts.envVars);
  const sim = createClaudeSimulator({
    exitCode: opts.exitCode ?? 0,
    responses: opts.simulatorResponses,
  });
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
    fetch: opts.fetcher,
    buildPrompt,
    buildReworkPrompt,
  });

  const run = (argv: readonly string[] = []) => {
    const ctx = createContext({ projectRoot: repo.workDir, argv });
    return runPipeline(ctx, deps);
  };

  return { repo, run };
}

// ─── Shared response helper ─────────────────────────────────────────────────

/** Build a JSON Response with the given data and status code. */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Shared board env fixtures ──────────────────────────────────────────────

export const GITHUB_ENV = {
  GITHUB_TOKEN: 'ghp_test',
  GITHUB_REPO: 'test-org/test-repo',
  CLANCY_LABEL: 'clancy',
};

export const JIRA_ENV = {
  JIRA_BASE_URL: 'https://test.atlassian.net',
  JIRA_USER: 'test@example.com',
  JIRA_API_TOKEN: 'test-api-token',
  JIRA_PROJECT_KEY: 'PROJ',
  CLANCY_LABEL: 'clancy',
};

export const LINEAR_ENV = {
  LINEAR_API_KEY: 'lin_test_key_abc123',
  LINEAR_TEAM_ID: 'team-uuid-123',
  CLANCY_LABEL: 'clancy',
};

export const SHORTCUT_ENV = {
  SHORTCUT_API_TOKEN: 'sc-test-token-abc123',
  CLANCY_LABEL: 'clancy',
};

export const NOTION_ENV = {
  NOTION_TOKEN: 'ntn_test_token_abc123',
  NOTION_DATABASE_ID: '11223344-5566-7788-99aa-bbccddeeff00',
  CLANCY_LABEL: 'clancy',
};

export const AZDO_ENV = {
  AZDO_ORG: 'test-org',
  AZDO_PROJECT: 'test-project',
  AZDO_PAT: 'test-pat-abc123',
  CLANCY_LABEL: 'clancy',
};

// ─── Shared GitHub mock fetcher ─────────────────────────────────────────────

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

/** Route definitions for the GitHub mock fetcher. */
const GITHUB_ROUTES: ReadonlyArray<{
  readonly method: string;
  readonly pattern: RegExp;
  readonly respond: (url: string, init?: RequestInit) => Response;
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

/** Create a mock fetcher for the GitHub API with all happy-path routes. */
export function createGitHubFetcher() {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    const method = init?.method ?? 'GET';
    const match = GITHUB_ROUTES.find(
      (r) => r.method === method && r.pattern.test(url),
    );
    return (
      match?.respond(url, init) ?? new Response('Not Found', { status: 404 })
    );
  };
}
