/**
 * Tests for the readiness invoker — spawns Claude with the rubric
 * and parses the verdict from stdout.
 */
import type { SpawnSyncFn } from '../types/index.js';
import type { SpawnSyncReturns } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

import { invokeReadinessGrade } from './invoke.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const VALID_VERDICT = {
  ticketId: 'PROJ-42',
  overall: 'green',
  checks: [
    { id: 'clear', verdict: 'green', reason: 'Clear' },
    { id: 'testable', verdict: 'green', reason: 'Testable' },
    { id: 'small', verdict: 'green', reason: 'Small' },
    { id: 'locatable', verdict: 'green', reason: 'Locatable' },
    { id: 'touch-bounded', verdict: 'green', reason: 'Bounded' },
  ],
  gradedAt: '2026-04-11T00:00:00Z',
  rubricSha: 'abc123',
};

function makeSpawn(stdout: string, status: number = 0): SpawnSyncFn {
  return vi.fn().mockReturnValue({
    stdout,
    stderr: '',
    status,
    signal: null,
    pid: 1,
    output: [],
  } satisfies SpawnSyncReturns<string>);
}

function wrapInFence(obj: unknown): string {
  return `\`\`\`json\n${JSON.stringify(obj)}\n\`\`\``;
}

const BASE_OPTS = {
  rubric: '# Readiness rubric\n...',
  ticketId: 'PROJ-42',
  ticketTitle: 'Add login page',
  ticketDescription: 'Create login page.',
  projectRoot: '/tmp/test',
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('invokeReadinessGrade', () => {
  it('returns parsed verdict on success', () => {
    const spawn = makeSpawn(wrapInFence(VALID_VERDICT));

    const result = invokeReadinessGrade({ ...BASE_OPTS, spawn });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.verdict.ticketId).toBe('PROJ-42');
      expect(result.verdict.overall).toBe('green');
    }
  });

  it('passes rubric + ticket as stdin prompt', () => {
    const spawn = makeSpawn(wrapInFence(VALID_VERDICT));

    invokeReadinessGrade({ ...BASE_OPTS, spawn });

    const call = vi.mocked(spawn).mock.calls[0]!;
    const input = call[2].input;
    expect(input).toContain('# Readiness rubric');
    expect(input).toContain('PROJ-42');
    expect(input).toContain('Add login page');
    expect(input).toContain('Create login page.');
  });

  it('spawns claude with -p and --dangerously-skip-permissions', () => {
    const spawn = makeSpawn(wrapInFence(VALID_VERDICT));

    invokeReadinessGrade({ ...BASE_OPTS, spawn });

    const call = vi.mocked(spawn).mock.calls[0]!;
    expect(call[0]).toBe('claude');
    expect(call[1]).toContain('-p');
    expect(call[1]).toContain('--dangerously-skip-permissions');
  });

  it('returns error when Claude exits non-zero', () => {
    const spawn = makeSpawn('', 1);

    const result = invokeReadinessGrade({ ...BASE_OPTS, spawn });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Claude process failed');
    }
  });

  it('returns error when stdout has no JSON fence', () => {
    const spawn = makeSpawn('Just some text, no JSON.');

    const result = invokeReadinessGrade({ ...BASE_OPTS, spawn });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('No fenced JSON block');
    }
  });

  it('returns error when verdict fails schema validation', () => {
    const spawn = makeSpawn(wrapInFence({ ticketId: 'X' }));

    const result = invokeReadinessGrade({ ...BASE_OPTS, spawn });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Schema validation failed');
    }
  });

  it('passes model flag when provided', () => {
    const spawn = makeSpawn(wrapInFence(VALID_VERDICT));

    invokeReadinessGrade({ ...BASE_OPTS, spawn, model: 'sonnet' });

    const call = vi.mocked(spawn).mock.calls[0]!;
    expect(call[1]).toContain('--model');
    expect(call[1]).toContain('sonnet');
  });
});
