/**
 * Local-mode wiring for `--from` plan execution.
 *
 * Extracted from dep-factory to keep it under the 300-line limit.
 * Provides preflight and ticket-seed helpers that the dep-factory
 * calls when `ctx.fromPath` is set.
 */
import type { FetchFn } from '../lifecycle/pr-creation.js';
import type { RunContext } from '../pipeline/context.js';
import type { EnvFileSystem, ExecGit } from '@chief-clancy/core';

import { basename } from 'node:path';

import { createBoard, detectBoard } from '@chief-clancy/core';

import { runLocalPreflight } from '../lifecycle/local-mode.js';
import {
  parsePlanFile,
  toSyntheticTicket,
} from '../lifecycle/plan-file/plan-file.js';
import { runPreflight } from '../lifecycle/preflight/preflight.js';
import { preflightPhase } from '../pipeline/phases/preflight-phase.js';

/** Check whether the cwd is inside a git repository. */
function isGitRepo(exec: ExecGit): boolean {
  try {
    exec(['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

/** Adapt the legacy {@link runPreflight} shape to the tagged-error contract. */
function runPreflightTagged(
  opts: { readonly envFs: EnvFileSystem; readonly exec: ExecGit },
  root: string,
):
  | {
      readonly ok: true;
      readonly warning?: string;
      readonly env?: Record<string, string>;
    }
  | {
      readonly ok: false;
      readonly error: { readonly kind: 'unknown'; readonly message: string };
      readonly warning?: string;
    } {
  const result = runPreflight(root, {
    exec: (file, args) => opts.exec([file, ...args]),
    envFs: opts.envFs,
  });
  if (!result.ok) {
    return {
      ok: false,
      error: {
        kind: 'unknown',
        message: result.error ?? 'preflight failed',
      },
    };
  }
  return { ok: true, warning: result.warning, env: result.env };
}

/**
 * Build the preflight closure with local-mode branching.
 *
 * When `ctx.fromPath` is set, runs synthetic local preflight.
 * Otherwise delegates to the real board preflight.
 *
 * @param opts - Shared I/O resources from dep-factory.
 * @returns A preflight closure for the pipeline.
 */
export function wirePreflight(opts: {
  readonly envFs: EnvFileSystem;
  readonly projectRoot: string;
  readonly exec: ExecGit;
  readonly fetch: FetchFn;
}): (ctx: RunContext) => Promise<
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: { readonly kind: 'unknown'; readonly message: string };
    }
> {
  return (ctx) => {
    if (ctx.fromPath) {
      if (!isGitRepo(opts.exec)) {
        return Promise.resolve({
          ok: false,
          error: {
            kind: 'unknown',
            message: 'Not inside a git repository',
          },
        });
      }
      runLocalPreflight(ctx, {
        envFs: opts.envFs,
        projectRoot: opts.projectRoot,
      });
      return Promise.resolve({ ok: true });
    }

    return preflightPhase(ctx, {
      runPreflight: (root) =>
        runPreflightTagged({ envFs: opts.envFs, exec: opts.exec }, root),
      detectBoard: (env) => detectBoard(env),
      createBoard: (config) =>
        createBoard(config, (url, init) => opts.fetch(url, init ?? {})),
    });
  };
}

/**
 * Parse the plan file at `fromPath` and pre-seed `ctx.ticket`.
 *
 * Derives slug from the plan filename (minus `.md` extension). Returns a
 * tagged Result — a malformed plan is user-triggerable (the caller supplies
 * the path via `--from`), so failure propagates through the caller's own
 * Result channel rather than an unstructured throw.
 */
export function localTicketSeed(
  ctx: RunContext,
  fromPath: string,
  readFile: (path: string) => string,
):
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: { readonly kind: 'unknown'; readonly message: string };
    } {
  const slug = basename(fromPath, '.md');
  const content = readFile(fromPath);
  const result = parsePlanFile(content, slug);
  if (!result.ok) {
    return {
      ok: false,
      error: {
        kind: 'unknown',
        message: `Failed to parse plan file ${fromPath}: ${result.error.message}`,
      },
    };
  }
  ctx.setTicket(toSyntheticTicket(result.plan));
  return { ok: true };
}
