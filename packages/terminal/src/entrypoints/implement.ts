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
import type {
  CostFs,
  ExecCmd,
  FetchFn,
  ListPlansFs,
  LockFs,
  ProgressFs,
  QualityFs,
  SpawnSyncFn,
  StreamingSpawnFn,
  StreamingSpawnResult,
} from '@chief-clancy/dev';
import type { SpawnSyncReturns } from 'node:child_process';

import { spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPipeline } from '@chief-clancy/dev';

import { runImplementBatch } from '../runner/implement/batch.js';
import { runImplement } from '../runner/implement/implement.js';

type SpawnFn = (
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
export function makeExecGit(cwd: string, spawn: SpawnFn = spawnSync): ExecGit {
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

/**
 * Build an ExecCmd adapter for arbitrary binaries (e.g. `claude`, `git`).
 *
 * Separate from {@link makeExecGit} — preflight probes non-git binaries,
 * and an `ExecGit` that prepends `git` would turn `claude --version` into
 * `git claude --version` and fail spuriously.
 *
 * @param cwd - Working directory for the spawned process.
 * @param spawn - Spawn function (injected for testability).
 * @returns An ExecCmd function that throws on failure.
 */
export function makeExecCmd(cwd: string, spawn: SpawnFn = spawnSync): ExecCmd {
  return (file, args) => {
    const result = spawn(file, [...args], { cwd, encoding: 'utf8' });

    if (result.status !== 0) {
      const code = result.status ?? 'null';
      const detail = result.stderr?.trim();
      const message = detail
        ? `${file} failed (exit ${code}): ${detail}`
        : `${file} failed (exit ${code})`;

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

/** Parse `--from {path}` from argv, returning undefined if absent. */
function parseFromArg(argv: readonly string[]): string | undefined {
  const idx = argv.indexOf('--from');
  if (idx === -1 || idx + 1 >= argv.length) return undefined;
  const value = argv[idx + 1];
  if (value.startsWith('--')) return undefined;
  return value;
}

/** Check whether the given path is a directory. Only treats ENOENT as "not found". */
function isDirectory(filePath: string): boolean {
  try {
    return statSync(filePath).isDirectory();
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * Build a real-Node {@link StreamingSpawnFn} for autonomous Claude sessions.
 *
 * Spawns the child with all three pipes captured, tees stdout/stderr live to
 * the parent process so the operator sees Claude's output as it happens, and
 * accumulates both streams into buffers returned in the resolved result.
 *
 * @returns An async streaming spawn function suitable for `invokeClaudeSession`.
 */
/** Class wrapper around a string-chunk accumulator (lint-functional exempt). */
class ChunkAccumulator {
  // eslint-disable-next-line functional/prefer-readonly-type -- accumulator must be mutable to capture streaming chunks
  private readonly chunks: string[] = [];
  public push(chunk: string): void {
    this.chunks.push(chunk);
  }
  public toString(): string {
    return this.chunks.join('');
  }
}

export function makeStreamingSpawn(): StreamingSpawnFn {
  return (command, args, options) =>
    new Promise<StreamingSpawnResult>((resolve) => {
      const child = spawn(command, [...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stdoutAcc = new ChunkAccumulator();
      const stderrAcc = new ChunkAccumulator();

      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');

      child.stdout?.on('data', (chunk: string) => {
        stdoutAcc.push(chunk);
        process.stdout.write(chunk);
      });
      child.stderr?.on('data', (chunk: string) => {
        stderrAcc.push(chunk);
        process.stderr.write(chunk);
      });

      child.on('error', (error) => {
        resolve({
          stdout: stdoutAcc.toString(),
          stderr: stderrAcc.toString(),
          status: null,
          signal: null,
          error,
        });
      });
      child.on('close', (code, signal) => {
        resolve({
          stdout: stdoutAcc.toString(),
          stderr: stderrAcc.toString(),
          status: code,
          signal,
        });
      });

      child.stdin?.write(options.input);
      child.stdin?.end();
    });
}

/** Build a ListPlansFs adapter from real node:fs functions. */
export function makePlanFs(): ListPlansFs {
  return {
    readdir: (p: string) => readdirSync(p),
    exists: (p: string) => existsSync(p),
  };
}

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const argv = process.argv;
  const fromPath = parseFromArg(argv);
  const isAfk = argv.includes('--afk');

  const spawnFn: SpawnSyncFn = (cmd, args, opts) =>
    spawnSync(cmd, [...args], { ...opts, stdio: [...opts.stdio] });
  const streamingSpawnFn = makeStreamingSpawn();
  const fetchFn: FetchFn = globalThis.fetch.bind(globalThis);

  const shared = {
    projectRoot,
    exec: makeExecGit(projectRoot),
    execCmd: makeExecCmd(projectRoot),
    lockFs: makeLockFs(),
    progressFs: makeProgressFs(),
    costFs: makeCostFs(),
    envFs: makeEnvFs(),
    qualityFs: makeQualityFs(),
    spawn: spawnFn,
    streamingSpawn: streamingSpawnFn,
    fetch: fetchFn,
    runPipeline,
    console,
  };

  if (fromPath && isDirectory(fromPath)) {
    if (!isAfk) {
      console.error(
        'Error: --from with a directory requires --afk for batch mode.',
      );
      return;
    }
    await runImplementBatch({
      ...shared,
      directory: fromPath,
      argv,
      planFs: makePlanFs(),
    });
    return;
  }

  await runImplement({ ...shared, argv, isAfk });
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
