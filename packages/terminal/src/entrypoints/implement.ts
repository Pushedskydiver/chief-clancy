/**
 * Implement runtime entry point — wire real Node.js I/O into runImplement.
 *
 * This file is the entry point for the `clancy-implement.js` bundle.
 * It constructs all dependency injection adapters from real Node.js APIs
 * (fs, child_process, fetch) and calls runImplement with the full opts.
 *
 * Built by esbuild into a self-contained ESM bundle with zero npm deps.
 */
import type { EnvFileSystem, ExecGit } from '@chief-clancy/core';
import type { CostFs, LockFs, ProgressFs, QualityFs } from '@chief-clancy/dev';
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
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPipeline } from '@chief-clancy/dev';

import { runImplement } from '../runner/implement/implement.js';

// ─── Types ──────────────────────────────────────────────────────────────────

type GitSpawnFn = (
  command: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly encoding: 'utf8' },
) => SpawnSyncReturns<string>;

// ─── Adapter factories ──────────────────────────────────────────────────────

/**
 * Build an ExecGit adapter from a spawn function.
 *
 * Wraps `spawnSync('git', args)` with error handling on non-zero exit.
 *
 * @param cwd - Working directory for git commands.
 * @param spawn - Spawn function (injected for testability).
 * @returns An ExecGit function that throws on failure.
 */
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

/** Build a LockFs adapter from real node:fs functions. */
export function makeLockFs(): LockFs {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
    writeFile: (path, content) => writeFileSync(path, content, 'utf8'),
    deleteFile: (path) => unlinkSync(path),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

/** Build a ProgressFs adapter from real node:fs functions. */
export function makeProgressFs(): ProgressFs {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
    appendFile: (path, content) => appendFileSync(path, content, 'utf8'),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

/** Build a CostFs adapter from real node:fs functions. */
export function makeCostFs(): CostFs {
  return {
    appendFile: (path, content) => appendFileSync(path, content, 'utf8'),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

/** Build a QualityFs adapter from real node:fs functions. */
export function makeQualityFs(): QualityFs {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
    writeFile: (path, content) => writeFileSync(path, content, 'utf8'),
    rename: (from, to) => renameSync(from, to),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  };
}

/** Build an EnvFileSystem adapter from real node:fs functions. */
export function makeEnvFs(): EnvFileSystem {
  return {
    readFile: (path) => readFileSync(path, 'utf8'),
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const projectRoot = process.cwd();

  await runImplement({
    argv: process.argv,
    projectRoot,
    isAfk: false,
    exec: makeExecGit(projectRoot),
    lockFs: makeLockFs(),
    progressFs: makeProgressFs(),
    costFs: makeCostFs(),
    envFs: makeEnvFs(),
    qualityFs: makeQualityFs(),
    spawn: (cmd, args, opts) =>
      spawnSync(cmd, [...args], { ...opts, stdio: [...opts.stdio] }),
    fetch: globalThis.fetch.bind(globalThis),
    runPipeline,
    console,
  });
}

// Main guard — self-execute when run directly (e.g. node .clancy/clancy-implement.js)
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
  });
}
