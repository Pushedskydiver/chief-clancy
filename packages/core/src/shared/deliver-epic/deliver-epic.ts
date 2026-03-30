/**
 * Epic PR delivery — create the final PR from epic branch to base branch.
 *
 * Called by the epic-completion phase when all children of an epic are
 * done. Gathers child entries from progress, builds the epic PR body,
 * creates the PR, and appends progress. Returns structured results —
 * no console output. Board transitions are the caller's responsibility.
 */
import type { FetchFn } from '~/c/dev/lifecycle/pr-creation/index.js';
import type { ProgressFs } from '~/c/dev/lifecycle/progress/index.js';
import type { BoardConfig } from '~/c/schemas/env/env.js';
import type { ExecGit } from '~/c/shared/git-ops/index.js';
import type { PrCreationResult, RemoteInfo } from '~/c/types/remote.js';

import { resolveCommitType } from '~/c/dev/lifecycle/commit-type/index.js';
import { gatherChildEntries } from '~/c/dev/lifecycle/epic/index.js';
import {
  computeDeliveryOutcome,
  progressForOutcome,
} from '~/c/dev/lifecycle/outcome/index.js';
import { attemptPrCreation } from '~/c/dev/lifecycle/pr-creation/index.js';
import { appendProgress } from '~/c/dev/lifecycle/progress/index.js';
import { buildEpicPrBody } from '~/c/dev/lifecycle/pull-request/pr-body/index.js';
import { detectRemote } from '~/c/shared/git-ops/index.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Options for {@link deliverEpicToBase}. */
type DeliverEpicOpts = {
  readonly exec: ExecGit;
  readonly fetchFn: FetchFn;
  readonly progressFs: ProgressFs;
  readonly projectRoot: string;
  readonly config: BoardConfig;
  readonly epicKey: string;
  readonly epicTitle: string;
  readonly epicBranch: string;
  readonly baseBranch: string;
  readonly ticketType?: string;
};

/** Result of an epic delivery attempt. */
type DeliverEpicResult = {
  readonly ok: boolean;
  readonly outcome: ReturnType<typeof computeDeliveryOutcome>;
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create the final PR from the epic branch to the base branch.
 *
 * Gathers child entries from progress, builds the PR body, attempts
 * PR creation, computes the outcome, and appends progress. Returns
 * a structured result — no console output.
 *
 * @param opts - Epic delivery options with DI dependencies.
 * @returns Result with `ok` status and delivery outcome.
 */
export async function deliverEpicToBase(
  opts: DeliverEpicOpts,
): Promise<DeliverEpicResult> {
  const { exec, config, epicKey, epicBranch, baseBranch } = opts;

  const childEntries = gatherChildEntries({
    progressFs: opts.progressFs,
    projectRoot: opts.projectRoot,
    epicKey,
  });

  const remote = detectRemote(exec, config.env.CLANCY_GIT_PLATFORM);
  const prResult = await createEpicPr(opts, remote, childEntries);
  const outcome = computeDeliveryOutcome({
    pr: prResult,
    remote,
    sourceBranch: epicBranch,
    targetBranch: baseBranch,
  });

  appendEpicProgress(opts, outcome);

  return resolveResult(outcome);
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Build and attempt the epic PR creation. */
async function createEpicPr(
  opts: DeliverEpicOpts,
  remote: RemoteInfo,
  childEntries: ReturnType<typeof gatherChildEntries>,
): Promise<PrCreationResult | undefined> {
  const { fetchFn, config, epicKey, epicTitle, epicBranch, baseBranch } = opts;

  const commitType = resolveCommitType(opts.ticketType);
  const prTitle = `${commitType}(${epicKey}): ${epicTitle}`;
  const prBody = buildEpicPrBody({
    epicKey,
    epicTitle,
    childEntries,
    provider: config.provider,
  });

  return attemptPrCreation({
    fetchFn,
    env: config.env,
    remote,
    sourceBranch: epicBranch,
    targetBranch: baseBranch,
    title: prTitle,
    body: prBody,
  });
}

/** Append epic progress based on outcome. */
function appendEpicProgress(
  opts: DeliverEpicOpts,
  outcome: ReturnType<typeof computeDeliveryOutcome>,
): void {
  const { status, prNumber } = progressForOutcome(outcome);
  const epicStatus = status === 'PR_CREATED' ? 'EPIC_PR_CREATED' : status;

  appendProgress(opts.progressFs, opts.projectRoot, {
    key: opts.epicKey,
    summary: opts.epicTitle,
    status: epicStatus,
    prNumber,
  });
}

/** Map outcome to result — created/exists are ok, all others are not. */
function resolveResult(
  outcome: ReturnType<typeof computeDeliveryOutcome>,
): DeliverEpicResult {
  const ok = outcome.type === 'created' || outcome.type === 'exists';
  return { ok, outcome };
}
