/**
 * Local plan pipeline helpers for e2e tests.
 *
 * Provides setup for `--from` mode e2e tests:
 * - {@link writePlanFile} — write a plan `.md` file to disk
 * - {@link writeApprovalMarker} — compute SHA-256 and write `.approved` marker
 * - {@link setupLocalPipeline} — wire a pipeline with bare remote, plan file, and simulator
 *
 * No board credentials needed — local mode uses synthetic config + no-op board.
 */
import type { PipelineDeps, PipelineResult } from '@chief-clancy/dev';

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
import { dirname, join } from 'node:path';

import {
  buildPipelineDeps,
  buildPrompt,
  buildReworkPrompt,
  createContext,
  runPipeline,
} from '@chief-clancy/dev';

import { createClaudeSimulator } from '../../helpers/claude-simulator.js';

// ─── Plan file helpers ──────────────────────────────────────────────────────

/** Minimal plan file content for testing. */
const DEFAULT_PLAN = `## Clancy Implementation Plan

**Source:** .clancy/briefs/test-brief.md
**Row:** #1 — Test feature implementation
**Planned:** 2026-04-13

### Summary

Implement the test feature with proper error handling.

### Affected Files

| File | Change Type | Description |
| --- | --- | --- |
| \`src/feature.ts\` | Create | New feature module |

### Implementation Approach

Create the feature module with TDD.

### Test Strategy

- [ ] Unit tests for the feature module
- [ ] Integration test for the happy path

### Acceptance Criteria

- [ ] Feature module exists and is tested
- [ ] All tests pass

### Dependencies

None

### Risks / Considerations

None identified.

### Size Estimate

**S** — Small: single module
`;

/**
 * Write a plan file to disk.
 *
 * @param directory - Directory to write the plan file in.
 * @param slug - Plan slug (used as filename without `.md`).
 * @param content - Plan markdown content (defaults to a minimal fixture).
 * @returns The full path to the written plan file.
 */
function writePlanFile(
  directory: string,
  slug: string,
  content: string = DEFAULT_PLAN,
): string {
  mkdirSync(directory, { recursive: true });
  const filePath = join(directory, `${slug}.md`);
  writeFileSync(filePath, content, 'utf8');
  return filePath;
}

/**
 * Write an `.approved` marker for a plan file.
 *
 * Computes SHA-256 of the plan content and writes a marker
 * with the hash and current timestamp.
 *
 * @param planPath - Path to the plan `.md` file.
 * @param planContent - Content of the plan file (for SHA computation).
 * @returns The full path to the written marker file.
 */
function writeApprovalMarker(planPath: string, planContent: string): string {
  const sha = createHash('sha256').update(planContent).digest('hex');
  const markerPath = planPath.replace(/\.md$/, '.approved');
  const marker = `sha256=${sha}\napproved_at=${new Date().toISOString()}\n`;
  writeFileSync(markerPath, marker, 'utf8');
  return markerPath;
}

// ─── Pipeline setup ─────────────────────────────────────────────────────────

type LocalPipelineSetup = {
  /** Absolute path to the repo root. */
  readonly workDir: string;
  /** Path to the plan file. */
  readonly planPath: string;
  /** Git executor scoped to the repo. */
  readonly exec: (args: readonly string[]) => string;
  /** Run the pipeline with optional extra argv. */
  readonly run: (argv?: readonly string[]) => Promise<PipelineResult>;
  /** The Claude simulator's spawn function (for call inspection). */
  readonly simulator: { readonly callCount: number };
  /** Clean up all temp files. */
  readonly cleanup: () => void;
};

type LocalSetupOpts = {
  /** Plan slug (default: 'test-plan-1'). */
  readonly slug?: string;
  /** Plan content (default: minimal fixture). */
  readonly planContent?: string;
  /** Whether to write an approval marker (default: true). */
  readonly approved?: boolean;
  /** Override the marker content (e.g. for SHA mismatch testing). */
  readonly markerContent?: string;
  /** Claude simulator exit code (default: 0). */
  readonly exitCode?: number;
};

/**
 * Set up a local-mode pipeline with bare remote and plan file.
 *
 * Creates a temp git repo, writes the plan file (and optionally an
 * approval marker), and wires the pipeline for `--from` execution.
 * No board credentials needed.
 *
 * @param opts - Configuration overrides.
 * @returns Setup handle with run function and cleanup.
 */
function setupLocalPipeline(opts: LocalSetupOpts = {}): LocalPipelineSetup {
  const slug = opts.slug ?? 'test-plan-1';
  const planContent = opts.planContent ?? DEFAULT_PLAN;
  const approved = opts.approved ?? true;

  // Create temp repo with bare remote
  const base = mkdtempSync(join(tmpdir(), 'clancy-local-e2e-'));
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

  // Seed initial commit
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

  // Write plan file
  const plansDir = join(workDir, '.clancy', 'plans');
  const planPath = writePlanFile(plansDir, slug, planContent);

  // Optionally write approval marker
  if (approved) {
    if (opts.markerContent) {
      const markerPath = planPath.replace(/\.md$/, '.approved');
      writeFileSync(markerPath, opts.markerContent, 'utf8');
    } else {
      writeApprovalMarker(planPath, planContent);
    }
  }

  // Commit plan files so git status is clean
  execFileSync('git', ['add', '.'], { cwd: workDir, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'add plan file'], {
    cwd: workDir,
    stdio: 'pipe',
  });

  // Dual-mode exec (same as pipeline-helpers.ts)
  const STUBBED: Record<string, string> = { claude: '1.0.0 (stub)' };
  const REAL = new Set(['git', 'node', 'pnpm', 'npm']);
  const exec = (args: readonly string[]) => {
    if (args[0] in STUBBED) return STUBBED[args[0]];
    const isReal = REAL.has(args[0]);
    return execFileSync(
      isReal ? args[0] : 'git',
      isReal ? args.slice(1) : args,
      {
        cwd: workDir,
        stdio: 'pipe',
        encoding: 'utf8',
      },
    );
  };

  // Claude simulator
  const sim = createClaudeSimulator({ exitCode: opts.exitCode ?? 0 });

  // Real filesystem adapters
  const lockFs = {
    readFile: (p: string) => readFileSync(p, 'utf8'),
    writeFile: (p: string, c: string) => {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, c);
    },
    deleteFile: (p: string) => {
      try {
        rmSync(p);
      } catch {
        /* ignore */
      }
    },
    mkdir: (p: string) => mkdirSync(p, { recursive: true }),
  };

  const progressFs = {
    readFile: (p: string) => {
      try {
        return readFileSync(p, 'utf8');
      } catch {
        return '';
      }
    },
    appendFile: (p: string, c: string) => {
      mkdirSync(dirname(p), { recursive: true });
      appendFileSync(p, c);
    },
    mkdir: (p: string) => mkdirSync(p, { recursive: true }),
  };

  const costFs = {
    appendFile: (p: string, c: string) => {
      mkdirSync(dirname(p), { recursive: true });
      appendFileSync(p, c);
    },
    mkdir: (p: string) => mkdirSync(p, { recursive: true }),
  };

  const qualityFs = {
    readFile: (p: string) => {
      try {
        return readFileSync(p, 'utf8');
      } catch {
        return '{}';
      }
    },
    writeFile: (p: string, c: string) => {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, c);
    },
    rename: (from: string, to: string) => renameSync(from, to),
    mkdir: (p: string) => mkdirSync(p, { recursive: true }),
  };

  const envFs = {
    exists: existsSync,
    readFile: (p: string) => readFileSync(p, 'utf8'),
  };

  // No-op fetcher — local mode should never call external APIs.
  // If called, the test will fail with a clear message.
  const fetcher = () => {
    throw new Error(
      'Fetcher called in local mode — no board API calls expected',
    );
  };

  const deps: PipelineDeps = buildPipelineDeps({
    projectRoot: workDir,
    exec,
    lockFs,
    progressFs,
    costFs,
    envFs,
    qualityFs,
    spawn: sim.spawn,
    fetch: fetcher,
    buildPrompt,
    buildReworkPrompt,
  });

  const run = (argv: readonly string[] = []) => {
    const ctx = createContext({
      projectRoot: workDir,
      argv: ['--from', planPath, '--skip-feasibility', ...argv],
    });
    return runPipeline(ctx, deps);
  };

  const cleanup = () => rmSync(base, { recursive: true, force: true });

  return { workDir, planPath, exec, run, simulator: sim, cleanup };
}

export { DEFAULT_PLAN, setupLocalPipeline, writeApprovalMarker, writePlanFile };
export type { LocalPipelineSetup };
