/**
 * PR delivery orchestration.
 *
 * Push branch to remote, create PR/MR, compute outcome, and append
 * progress. No console output — returns structured results for the
 * terminal layer to display.
 */
import type { BoardConfig } from '~/c/schemas/env/env.js';
import type { ProgressFs } from '~/c/shared/progress/progress.js';
import type { EpicContext } from '~/c/shared/pull-request/pr-body/pr-body.js';
import type { FetchedTicket } from '~/c/types/board.js';
import type { PrCreationResult, RemoteInfo } from '~/c/types/remote.js';

import {
  checkout,
  detectRemote,
  pushBranch,
} from '~/c/shared/git-ops/git-ops.js';
import {
  computeDeliveryOutcome,
  progressForOutcome,
} from '~/c/shared/outcome/outcome.js';
import { attemptPrCreation } from '~/c/shared/pr-creation/pr-creation.js';
import { appendProgress } from '~/c/shared/progress/progress.js';
import { buildPrBody } from '~/c/shared/pull-request/pr-body/pr-body.js';

import { buildEpicContext } from './epic.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Git executor signature (injected). */
type ExecGit = (args: readonly string[]) => string;

/** Minimal fetch signature for platform API calls. */
type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

/** Filesystem for reading verification attempt counter. */
type DeliverFs = {
  readonly readFile: (path: string) => string;
};

/** Options for {@link deliverViaPullRequest}. */
type DeliverOpts = {
  readonly exec: ExecGit;
  readonly fetchFn: FetchFn;
  readonly progressFs: ProgressFs;
  readonly deliverFs: DeliverFs;
  readonly projectRoot: string;
  readonly config: BoardConfig;
  readonly ticket: FetchedTicket;
  readonly ticketBranch: string;
  readonly targetBranch: string;
  readonly skipLog?: boolean;
  readonly parent?: string;
  readonly singleChildParent?: string;
};

/** Result of a delivery attempt. */
type DeliveryResult = {
  readonly pushed: boolean;
  readonly outcome: ReturnType<typeof computeDeliveryOutcome>;
  readonly prResult?: PrCreationResult;
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Push branch to remote, create PR/MR, compute outcome, and append progress.
 *
 * Returns a structured result — no console output. The terminal layer
 * handles logging and board transitions based on the outcome.
 *
 * @param opts - Delivery options with DI dependencies.
 * @returns Delivery result with push status, outcome, and optional PR info.
 */
export async function deliverViaPullRequest(
  opts: DeliverOpts,
): Promise<DeliveryResult> {
  const { exec, ticketBranch, targetBranch } = opts;

  const pushed = pushBranch(exec, ticketBranch);

  if (!pushed) {
    return handlePushFailure(opts);
  }

  const remote = detectRemote(exec, opts.config.env.CLANCY_GIT_PLATFORM);
  const prResult = await createPr(opts, remote);
  const outcome = computeDeliveryOutcome({
    pr: prResult,
    remote,
    sourceBranch: ticketBranch,
    targetBranch,
  });

  appendDeliveryProgress(opts, outcome);
  safeCheckout(exec, targetBranch);

  return { pushed: true, outcome, prResult };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Handle push failure: log progress and return failure result. */
function handlePushFailure(opts: DeliverOpts): DeliveryResult {
  const { exec, progressFs, projectRoot, ticket, targetBranch } = opts;
  const { skipLog = false, parent } = opts;

  if (!skipLog) {
    appendProgress(progressFs, projectRoot, {
      key: ticket.key,
      summary: ticket.title,
      status: 'PUSH_FAILED',
      parent,
    });
  }

  safeCheckout(exec, targetBranch);

  return {
    pushed: false,
    outcome: { type: 'local' },
  };
}

/** Attempt PR creation with platform dispatch. */
async function createPr(
  opts: DeliverOpts,
  remote: RemoteInfo,
): Promise<PrCreationResult | undefined> {
  const { fetchFn, config, ticket, ticketBranch, targetBranch } = opts;

  const prTitle = `feat(${ticket.key}): ${ticket.title}`;
  const epicContext = resolveEpicContext(opts);
  const prBody = buildPrBody({
    config,
    ticket: {
      key: ticket.key,
      title: ticket.title,
      description: ticket.description,
      provider: config.provider,
    },
    targetBranch,
    verificationWarning: readVerificationWarning(opts),
    singleChildParent: opts.singleChildParent,
    epicContext,
  });

  return attemptPrCreation({
    fetchFn,
    env: config.env,
    remote,
    sourceBranch: ticketBranch,
    targetBranch,
    title: prTitle,
    body: prBody,
  });
}

/** Build epic context for child PRs targeting epic branches. */
function resolveEpicContext(opts: DeliverOpts): EpicContext | undefined {
  return buildEpicContext({
    progressFs: opts.progressFs,
    projectRoot: opts.projectRoot,
    parent: opts.parent,
    targetBranch: opts.targetBranch,
    ticketKey: opts.ticket.key,
  });
}

/** Read the verification attempt counter. Returns warning or `undefined`. */
function readVerificationWarning(opts: DeliverOpts): string | undefined {
  try {
    const attempt = opts.deliverFs
      .readFile(`${opts.projectRoot}/.clancy/verify-attempt.txt`)
      .trim();
    const attemptNum = parseInt(attempt, 10);
    if (attemptNum > 0) {
      return `Verification checks did not fully pass (${attemptNum} attempt(s)). Review carefully.`;
    }
  } catch {
    // No verify-attempt file — verification passed or wasn't run
  }
  return undefined;
}

/** Append delivery progress based on outcome. */
function appendDeliveryProgress(
  opts: DeliverOpts,
  outcome: ReturnType<typeof computeDeliveryOutcome>,
): void {
  if (opts.skipLog) return;

  const { status, prNumber } = progressForOutcome(outcome);
  appendProgress(opts.progressFs, opts.projectRoot, {
    key: opts.ticket.key,
    summary: opts.ticket.title,
    status,
    prNumber,
    parent: opts.parent,
  });
}

/** Checkout a branch, ignoring errors. */
function safeCheckout(exec: ExecGit, branch: string): void {
  try {
    checkout(exec, branch);
  } catch {
    // Best-effort
  }
}
