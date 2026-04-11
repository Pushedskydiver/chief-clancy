/**
 * Node.js I/O adapter factories for entrypoint bundles.
 *
 * Shared between the single-ticket (`dev.ts`) and loop (`loop.ts`)
 * entrypoints. Both are bundled by esbuild into self-contained ESM
 * files, so this module is inlined at build time — no runtime dep.
 */
import type { AtomicFs } from '../artifacts/atomic-write/index.js';
import type { CostFs, LockFs, ProgressFs, QualityFs } from '../index.js';
import type { EnvFileSystem, ExecGit } from '@chief-clancy/core';
import type { SpawnSyncReturns } from 'node:child_process';

import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';

// ─── Types ──────────────────────────────────────────────────────────────────

type GitSpawnFn = (
  command: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly encoding: 'utf8' },
) => SpawnSyncReturns<string>;

// ─── Adapter factories ──────────────────────────────────────────────────────

/** Create a synchronous git executor bound to the given working directory. Throws on non-zero exit. */
export function makeExecGit(
  cwd: string,
  spawn: GitSpawnFn = spawnSync,
): ExecGit {
  return (args) => {
    const result = spawn('git', [...args], { cwd, encoding: 'utf8' });

    if (result.status !== 0) {
      const cmd = args[0] ?? 'unknown';
      const code = result.status ?? 'null';
      const detail = result.stderr?.trim();
      const message = detail
        ? `git ${cmd} failed (exit ${code}): ${detail}`
        : `git ${cmd} failed (exit ${code})`;

      throw new Error(message);
    }

    return result.stdout.trim();
  };
}

/** Create a synchronous lock-file adapter backed by `node:fs`. */
export function makeLockFs(): LockFs {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
    writeFile: (path, content) => writeFileSync(path, content, 'utf8'),
    deleteFile: (path) => unlinkSync(path),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

/** Create a synchronous progress-file adapter backed by `node:fs`. */
export function makeProgressFs(): ProgressFs {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
    appendFile: (path, content) => appendFileSync(path, content, 'utf8'),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

/** Create a synchronous cost-file adapter backed by `node:fs`. */
export function makeCostFs(): CostFs {
  return {
    appendFile: (path, content) => appendFileSync(path, content, 'utf8'),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

/** Create a synchronous quality-file adapter backed by `node:fs`. */
export function makeQualityFs(): QualityFs {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
    writeFile: (path, content) => writeFileSync(path, content, 'utf8'),
    rename: (from, to) => renameSync(from, to),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

/** Create a read-only env-file adapter backed by `node:fs`. */
export function makeEnvFs(): EnvFileSystem {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
  };
}

function isEnoent(err: unknown): boolean {
  return err instanceof Error && 'code' in err && err.code === 'ENOENT';
}

/** Create a synchronous atomic-write adapter backed by `node:fs`. */
export function makeAtomicFs(): AtomicFs {
  return {
    mkdir: (path) => mkdirSync(path, { recursive: true }),
    writeFile: (path, content) => writeFileSync(path, content, 'utf8'),
    rename: (from, to) => renameSync(from, to),
    readdir: (path) => {
      try {
        return readdirSync(path, 'utf8');
      } catch (err) {
        if (isEnoent(err)) return [];
        throw err;
      }
    },
    unlink: (path) => unlinkSync(path),
    stat: (path) => {
      try {
        const s = statSync(path);
        return { mtimeMs: s.mtimeMs };
      } catch (err) {
        if (isEnoent(err)) return undefined;
        throw err;
      }
    },
  };
}
