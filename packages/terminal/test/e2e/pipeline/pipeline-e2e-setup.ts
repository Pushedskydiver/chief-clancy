/**
 * Shared setup for E2E pipeline tests.
 *
 * Similar to integration's `pipeline-helpers.ts` but uses:
 * - Real board APIs (globalThis.fetch instead of mock fetchers)
 * - Real git remotes (sandbox repo instead of local bare remote)
 * - Claude simulator that creates commits (so deliver phase can PR)
 *
 * The Claude CLI is never invoked for real — the simulator creates
 * dummy implementation files and commits, then returns exit code 0.
 */
import type {
  CostFs,
  EnvFileSystem,
  LockFs,
  PipelineResult,
  ProgressFs,
  QualityFs,
} from '@chief-clancy/core';
import type { SpawnSyncFn } from '~/t/runner/shared/types.js';

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

// ── Filesystem adapters (same as integration) ──────────────────

function createRealFs(): {
  readonly lockFs: LockFs;
  readonly progressFs: ProgressFs;
  readonly costFs: CostFs;
  readonly qualityFs: QualityFs;
  readonly envFs: EnvFileSystem;
} {
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

// ── Temp repo with real remote ──────────────────────────────────

type E2ERepo = {
  readonly workDir: string;
  readonly exec: (args: readonly string[]) => string;
  readonly cleanup: () => void;
};

/**
 * Create a temp git repo that tracks a real GitHub sandbox remote.
 *
 * Fetches origin/main and resets to it (or pushes if the remote
 * is empty). Writes `.clancy/.env` with real credentials.
 *
 * @param remoteUrl - HTTPS URL of the sandbox repo.
 * @param envVars - Key-value pairs for `.clancy/.env`.
 * @returns Repo handle with workDir, exec, and cleanup.
 */
function createE2ERepo(
  remoteUrl: string,
  envVars: Record<string, string>,
): E2ERepo {
  const base = mkdtempSync(join(tmpdir(), 'clancy-e2e-'));
  const workDir = join(base, 'work');

  mkdirSync(workDir);
  const git = (args: readonly string[]) =>
    execFileSync('git', args, {
      cwd: workDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    });

  git(['init', '-b', 'main']);
  git(['config', 'user.email', 'test@clancy.dev']);
  git(['config', 'user.name', 'Clancy E2E']);
  git(['remote', 'add', 'origin', remoteUrl]);

  // Seed an initial commit so main exists locally
  writeFileSync(join(workDir, '.gitkeep'), '');
  git(['add', '.']);
  git(['commit', '-m', 'initial commit']);

  // Sync with remote main
  try {
    git(['fetch', 'origin', 'main']);
    git(['reset', '--hard', 'origin/main']);
  } catch {
    // Remote main doesn't exist yet — push our initial commit
    git(['push', '-u', 'origin', 'main']);
  }

  // Write .clancy/.env with real credentials (gitignored)
  const clancyDir = join(workDir, '.clancy');
  mkdirSync(clancyDir, { recursive: true });
  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}="${value}"`)
    .join('\n');
  writeFileSync(join(clancyDir, '.env'), envContent);
  writeFileSync(join(clancyDir, '.gitignore'), '.env\n');

  git(['add', '-A']);
  git(['commit', '-m', 'chore: add clancy scaffold']);

  // Exec helper for dep factory — same dual-mode as integration
  const STUBBED_BINARIES: Record<string, string> = {
    claude: '1.0.0 (stub)',
  };
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

// ── Claude simulator with commit side effects ───────────────────

/**
 * Create a Claude simulator that produces a real commit.
 *
 * When the pipeline calls `spawn('claude', ...)`, this wrapper:
 * 1. Creates a dummy implementation file
 * 2. Commits it to the current branch
 * 3. Returns exit code 0 (simulating successful Claude invocation)
 *
 * @param workDir - The repo working directory.
 * @param ticketKey - Used to name the implementation file.
 * @returns A SpawnSyncFn that can be injected into buildPipelineDeps.
 */
function createE2ESimulator(workDir: string, ticketKey: string): SpawnSyncFn {
  const sim = createClaudeSimulator({ exitCode: 0 });

  const wrappedSpawn: SpawnSyncFn = (command, args, options) => {
    const result = sim.spawn(command, args, options);

    // After Claude "runs", create a real commit so deliver can PR
    if (command === 'claude' && result.status === 0) {
      const slug = ticketKey.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const filePath = join(workDir, 'src', `${slug}.ts`);
      mkdirSync(join(filePath, '..'), { recursive: true });
      writeFileSync(
        filePath,
        `/** Implementation for ${ticketKey}. */\nexport function impl(): string {\n  return '${ticketKey} implemented';\n}\n`,
      );
      execFileSync('git', ['add', '-A'], { cwd: workDir, stdio: 'pipe' });
      execFileSync(
        'git',
        ['commit', '-m', `feat(${ticketKey}): implement ticket`],
        { cwd: workDir, stdio: 'pipe' },
      );
    }

    return result;
  };

  return wrappedSpawn;
}

// ── Pipeline setup ──────────────────────────────────────────────

export type E2EPipelineSetup = {
  readonly repo: E2ERepo;
  readonly run: (argv?: readonly string[]) => Promise<PipelineResult>;
};

type E2ESetupOpts = {
  /** HTTPS URL of the sandbox repo. */
  readonly remoteUrl: string;
  /** Key-value pairs for `.clancy/.env`. */
  readonly envVars: Record<string, string>;
  /** Ticket key for naming the simulated implementation. */
  readonly ticketKey: string;
};

/**
 * Set up a full E2E pipeline run against a real board API.
 *
 * @param opts - Remote URL, env vars, and ticket key.
 * @returns Repo handle and run function.
 */
export function setupE2EPipeline(opts: E2ESetupOpts): E2EPipelineSetup {
  const repo = createE2ERepo(opts.remoteUrl, opts.envVars);
  const spawn = createE2ESimulator(repo.workDir, opts.ticketKey);
  const fs = createRealFs();

  const deps = buildPipelineDeps({
    projectRoot: repo.workDir,
    exec: repo.exec,
    lockFs: fs.lockFs,
    progressFs: fs.progressFs,
    costFs: fs.costFs,
    envFs: fs.envFs,
    qualityFs: fs.qualityFs,
    spawn,
    fetch: globalThis.fetch,
  });

  const run = (argv: readonly string[] = []) => {
    const ctx = createContext({
      projectRoot: repo.workDir,
      argv: ['--skip-feasibility', ...argv],
    });
    return runPipeline(ctx, deps);
  };

  return { repo, run };
}
