/**
 * Hook bundle smoke tests.
 *
 * Verifies that each esbuild-bundled CJS hook loads without crashing.
 * Catches bundling regressions (missing imports, CJS format issues,
 * runtime errors). PreToolUse hooks also verify JSON decision output.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const DIST_HOOKS = resolve(import.meta.dirname, '../../../dist/hooks');

const HOOK_NAMES = [
  'clancy-branch-guard',
  'clancy-check-update',
  'clancy-context-monitor',
  'clancy-credential-guard',
  'clancy-drift-detector',
  'clancy-notification',
  'clancy-post-compact',
  'clancy-statusline',
] as const;

const EMPTY_EVENT = JSON.stringify({
  tool_name: 'Bash',
  tool_input: { command: 'echo smoke-test' },
});

/** Run a CJS hook bundle via Node.js. Returns { exitCode, stdout }. */
function runHook(
  name: string,
  input: string = EMPTY_EVENT,
): { readonly exitCode: number; readonly stdout: string } {
  const hookPath = resolve(DIST_HOOKS, `${name}.js`);
  const script = `process.argv[2] = ${JSON.stringify(input)}; require(${JSON.stringify(hookPath)})`;

  try {
    const stdout = execFileSync('node', ['--input-type=commonjs'], {
      input: script,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    }).trim();

    return { exitCode: 0, stdout };
  } catch (err: unknown) {
    const code =
      err instanceof Error && 'status' in err
        ? (err as { status: number }).status
        : 1;
    return { exitCode: code, stdout: '' };
  }
}

// ─── Bundle existence ───────────────────────────────────────────────────────

describe('hook bundle existence', () => {
  it.each(HOOK_NAMES)('%s bundle exists', (name) => {
    expect(existsSync(resolve(DIST_HOOKS, `${name}.js`))).toBe(true);
  });
});

// ─── Bundle loads without crashing ──────────────────────────────────────────

describe('hook bundle loads without crashing', () => {
  it.each(HOOK_NAMES)('%s exits cleanly', (name) => {
    const { exitCode } = runHook(name);

    expect(exitCode).toBe(0);
  });
});

// ─── PreToolUse hooks return JSON decisions ─────────────────────────────────

describe('PreToolUse hook decisions', () => {
  it('branch-guard approves safe commands', () => {
    const { stdout } = runHook('clancy-branch-guard');
    const parsed = JSON.parse(stdout) as { decision: string };

    expect(parsed.decision).toBe('approve');
  });

  it('branch-guard blocks force push', () => {
    const input = JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'git push --force origin main' },
    });
    const { stdout } = runHook('clancy-branch-guard', input);
    const parsed = JSON.parse(stdout) as { decision: string };

    expect(parsed.decision).toBe('block');
  });

  it('credential-guard approves non-secret commands', () => {
    const { stdout } = runHook('clancy-credential-guard');
    const parsed = JSON.parse(stdout) as { decision: string };

    expect(parsed.decision).toBe('approve');
  });
});
