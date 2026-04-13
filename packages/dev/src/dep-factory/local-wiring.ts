/**
 * Local-mode wiring for `--from` plan execution.
 *
 * Extracted from dep-factory to keep it under the 300-line limit.
 * Provides preflight and ticket-seed helpers that the dep-factory
 * calls when `ctx.fromPath` is set.
 */
import type { FetchFn } from '../lifecycle/pr-creation/index.js';
import type { RunContext } from '../pipeline/context.js';
import type { EnvFileSystem, ExecGit } from '@chief-clancy/core';

import { basename } from 'node:path';

import { createBoard, detectBoard } from '@chief-clancy/core';

import { runLocalPreflight } from '../lifecycle/local-mode/index.js';
import {
  parsePlanFile,
  toSyntheticTicket,
} from '../lifecycle/plan-file/index.js';
import { runPreflight } from '../lifecycle/preflight/preflight.js';
import { preflightPhase } from '../pipeline/index.js';

/** Check whether the cwd is inside a git repository. */
function isGitRepo(exec: ExecGit): boolean {
  try {
    exec(['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
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
}): (
  ctx: RunContext,
) => Promise<{ readonly ok: boolean; readonly error?: string }> {
  return (ctx) => {
    if (ctx.fromPath) {
      if (!isGitRepo(opts.exec)) {
        return Promise.resolve({
          ok: false,
          error: 'Not inside a git repository',
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
        runPreflight(root, {
          exec: (file, args) => opts.exec([file, ...args]),
          envFs: opts.envFs,
        }),
      detectBoard: (env) => detectBoard(env),
      createBoard: (config) =>
        createBoard(config, (url, init) => opts.fetch(url, init ?? {})),
    });
  };
}

/**
 * Parse the plan file at `ctx.fromPath` and pre-seed `ctx.ticket`.
 *
 * Derives slug from the plan filename (minus `.md` extension).
 *
 * @param ctx - Pipeline context to seed the ticket on.
 * @param fromPath - Path to the plan file.
 * @param readFile - Filesystem read for the plan file.
 */
export function localTicketSeed(
  ctx: RunContext,
  fromPath: string,
  readFile: (path: string) => string,
): void {
  const slug = basename(fromPath, '.md');
  const content = readFile(fromPath);
  const plan = parsePlanFile(content, slug);
  ctx.setTicket(toSyntheticTicket(plan));
}
