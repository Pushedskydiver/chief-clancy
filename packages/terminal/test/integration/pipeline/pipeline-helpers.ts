/**
 * Shared helpers for pipeline integration tests.
 *
 * Extracts the reusable infrastructure from the GitHub happy-path test:
 * - {@link createRealFs} — real filesystem adapters for lock/progress/cost/quality/env
 * - {@link createRepoWithRemote} — temp git repo with bare remote and `.clancy/.env`
 * - {@link setupPipeline} — full pipeline wiring with configurable overrides
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

import { createContext, runPipeline } from '@chief-clancy/core';

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
  readonly deps: PipelineDeps;
  readonly run: (argv?: readonly string[]) => Promise<PipelineResult>;
};

type SetupOpts = {
  readonly envVars: Record<string, string>;
  readonly fetcher: (url: string, init?: RequestInit) => Promise<Response>;
  readonly exitCode?: number;
};

/**
 * Set up a full pipeline with the given board configuration.
 *
 * @param opts - Env vars, mock fetcher, and optional Claude exit code.
 * @returns Repo handle, wired deps, and a run function.
 */
export function setupPipeline(opts: SetupOpts): PipelineSetup {
  const repo = createRepoWithRemote(opts.envVars);
  const sim = createClaudeSimulator({ exitCode: opts.exitCode ?? 0 });
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
  });

  const run = (argv: readonly string[] = []) => {
    const ctx = createContext({ projectRoot: repo.workDir, argv });
    return runPipeline(ctx, deps);
  };

  return { repo, deps, run };
}

// ─── Shared response helper ─────────────────────────────────────────────────

/** Build a JSON Response with the given data and status code. */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
