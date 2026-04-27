/**
 * Node.js I/O adapter factories for entrypoint bundles.
 *
 * Shared between the single-ticket (`dev.ts`) and loop (`loop.ts`)
 * entrypoints. Both are bundled by esbuild into self-contained ESM
 * files, so this module is inlined at build time — no runtime dep.
 */
import type { AtomicFs } from '../artifacts/atomic-write.js';
import type { CostFs, LockFs, ProgressFs, QualityFs } from '../index.js';
import type { ExecCmd } from '../lifecycle/preflight/preflight.js';
import type { StreamingSpawnFn, StreamingSpawnResult } from '../types/spawn.js';
import type { EnvFileSystem, ExecGit } from '@chief-clancy/core';
import type { SpawnSyncReturns } from 'node:child_process';

import { spawn, spawnSync } from 'node:child_process';
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

type SpawnFn = (
  command: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly encoding: 'utf8' },
) => SpawnSyncReturns<string>;

// ─── Adapter factories ──────────────────────────────────────────────────────

/** Create a synchronous git executor bound to the given working directory. Throws on non-zero exit. */
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
 * Create a synchronous arbitrary-binary executor bound to the given working
 * directory. Throws on non-zero exit.
 *
 * Separate from {@link makeExecGit} because preflight probes non-git binaries
 * (`claude --version`, `git --version`) — an `ExecGit` that prepends `git`
 * would turn those into `git claude --version` and fail spuriously.
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

/**
 * Create a real-Node {@link StreamingSpawnFn} for autonomous Claude sessions.
 *
 * Spawns the child with all three pipes captured, tees stdout/stderr live to
 * the parent process so the operator sees Claude's output as it happens, and
 * accumulates both streams into buffers returned in the resolved result.
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
