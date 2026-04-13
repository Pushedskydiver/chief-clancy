/**
 * E2E: Local plan pipeline — full lifecycle with `--from`.
 *
 * Exercises the complete pipeline in local mode:
 * - Synthetic config + no-op board (no credentials needed)
 * - Real git operations (temp repo with bare remote)
 * - Claude simulator for the invoke phase
 * - Real filesystem for lock/progress/cost/quality
 *
 * Always runs in CI (no hasCredentials gate).
 */
import type { LocalPipelineSetup } from '../helpers/local-plan-setup.js';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { setupLocalPipeline } from '../helpers/local-plan-setup.js';

// ─── Shared cleanup ─────────────────────────────────────────────────────────

let pipeline: LocalPipelineSetup | undefined;

afterEach(() => {
  pipeline?.cleanup();
  pipeline = undefined;
});

// ─── Happy path ─────────────────────────────────────────────────────────────

describe('Local plan pipeline — happy path', { timeout: 30_000 }, () => {
  it('completes the full pipeline with --from', async () => {
    pipeline = setupLocalPipeline();

    const result = await pipeline.run();

    expect(result.status).toBe('completed');
  });

  it('creates a feature branch with the plan slug', async () => {
    pipeline = setupLocalPipeline({ slug: 'add-dark-mode-1' });

    await pipeline.run();

    const branches = pipeline.exec(['branch', '--list']).trim();
    expect(branches).toContain('feature/add-dark-mode-1');
  });

  it('appends a progress entry with the plan slug', async () => {
    pipeline = setupLocalPipeline({ slug: 'my-feature-3' });

    await pipeline.run();

    const progressPath = join(pipeline.workDir, '.clancy', 'progress.txt');
    expect(existsSync(progressPath)).toBe(true);

    const content = readFileSync(progressPath, 'utf8');
    expect(content).toContain('my-feature-3');
  });

  it('cleans up the lock file after completion', async () => {
    pipeline = setupLocalPipeline();

    await pipeline.run();

    const lockPath = join(pipeline.workDir, '.clancy', 'lock.json');
    expect(existsSync(lockPath)).toBe(false);
  });

  it('invokes the Claude simulator', async () => {
    pipeline = setupLocalPipeline();

    await pipeline.run();

    expect(pipeline.simulator.callCount).toBeGreaterThan(0);
  });
});

// ─── Dry run ────────────────────────────────────────────────────────────────

describe('Local plan pipeline — dry run', { timeout: 30_000 }, () => {
  it('returns dry-run status with --dry-run flag', async () => {
    pipeline = setupLocalPipeline();

    const result = await pipeline.run(['--dry-run']);

    expect(result.status).toBe('dry-run');
  });

  it('does not create a feature branch in dry-run mode', async () => {
    pipeline = setupLocalPipeline({ slug: 'dry-run-test' });

    await pipeline.run(['--dry-run']);

    const branches = pipeline.exec(['branch', '--list']).trim();
    expect(branches).not.toContain('feature/dry-run-test');
  });
});

// ─── Advisory paths ─────────────────────────────────────────────────────────

describe('Local plan pipeline — advisory approval', { timeout: 30_000 }, () => {
  it('completes without an approval marker (advisory only)', async () => {
    pipeline = setupLocalPipeline({ approved: false });

    const result = await pipeline.run();

    expect(result.status).toBe('completed');
  });

  it('completes with a stale approval marker (SHA mismatch)', async () => {
    pipeline = setupLocalPipeline({
      markerContent:
        'sha256=0000000000000000\napproved_at=2026-01-01T00:00:00Z\n',
    });

    const result = await pipeline.run();

    expect(result.status).toBe('completed');
  });
});

// ─── Error paths ────────────────────────────────────────────────────────────

describe('Local plan pipeline — error paths', { timeout: 30_000 }, () => {
  it('aborts at invoke when Claude exits non-zero', async () => {
    pipeline = setupLocalPipeline({ exitCode: 1 });

    const result = await pipeline.run();

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('invoke');
  });
});
