/**
 * Node.js I/O adapter factories for entrypoint bundles.
 *
 * Shared between the single-ticket (`dev.ts`) and loop (`loop.ts`)
 * entrypoints. Both are bundled by esbuild into self-contained ESM
 * files, so this module is inlined at build time — no runtime dep.
 */
import type { CostFs, LockFs, ProgressFs, QualityFs } from '../index.js';
import type { EnvFileSystem, ExecGit } from '@chief-clancy/core';
import type { SpawnSyncReturns } from 'node:child_process';

import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
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

export function makeLockFs(): LockFs {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
    writeFile: (path, content) => writeFileSync(path, content, 'utf8'),
    deleteFile: (path) => unlinkSync(path),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

export function makeProgressFs(): ProgressFs {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
    appendFile: (path, content) => appendFileSync(path, content, 'utf8'),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

export function makeCostFs(): CostFs {
  return {
    appendFile: (path, content) => appendFileSync(path, content, 'utf8'),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

export function makeQualityFs(): QualityFs {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
    writeFile: (path, content) => writeFileSync(path, content, 'utf8'),
    rename: (from, to) => renameSync(from, to),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

export function makeEnvFs(): EnvFileSystem {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
  };
}
