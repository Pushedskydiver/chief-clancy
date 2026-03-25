/**
 * Pure outcome computation for delivery results.
 *
 * Replaces if/else chains in delivery orchestration with a
 * discriminated union. The orchestrator switches on `type` for
 * logging and progress, keeping side effects separate from decisions.
 */
import type { ProgressStatus } from '~/c/types/progress.js';
import type { PrCreationResult, RemoteInfo } from '~/c/types/remote.js';

import { buildManualPrUrl } from '~/c/shared/pr-creation/index.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** PR was created successfully. */
type CreatedOutcome = {
  readonly type: 'created';
  readonly url: string;
  readonly number: number;
};

/** PR creation failed — includes error and optional manual URL. */
type FailedOutcome = {
  readonly type: 'failed';
  readonly error: string;
  readonly manualUrl?: string;
};

/** PR creation was not attempted — includes optional manual URL. */
type NotAttemptedOutcome = {
  readonly type: 'not_attempted';
  readonly manualUrl?: string;
};

/** Discriminated union of all possible delivery outcomes after push succeeds. */
type DeliveryOutcome =
  | CreatedOutcome
  | { readonly type: 'exists' }
  | FailedOutcome
  | NotAttemptedOutcome
  | { readonly type: 'local' }
  | { readonly type: 'unsupported' };

/** Options for {@link computeDeliveryOutcome}. */
type ComputeOutcomeOpts = {
  readonly pr: PrCreationResult | undefined;
  readonly remote: RemoteInfo;
  readonly sourceBranch: string;
  readonly targetBranch: string;
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute the delivery outcome from a PR creation result and remote info.
 *
 * Pure function — no side effects, no I/O. The caller handles logging
 * and progress based on the returned outcome type.
 *
 * @param opts - The PR result, remote info, and branch names.
 * @returns The delivery outcome.
 */
export function computeDeliveryOutcome(
  opts: ComputeOutcomeOpts,
): DeliveryOutcome {
  const { pr, remote, sourceBranch, targetBranch } = opts;

  if (remote.host === 'none') return { type: 'local' };
  if (remote.host === 'unknown') return { type: 'unsupported' };

  if (pr?.ok) {
    return { type: 'created', url: pr.url, number: pr.number };
  }

  if (pr && !pr.ok && pr.alreadyExists) {
    return { type: 'exists' };
  }

  if (pr && !pr.ok) {
    return {
      type: 'failed',
      error: pr.error,
      manualUrl: buildManualPrUrl(remote, sourceBranch, targetBranch),
    };
  }

  return {
    type: 'not_attempted',
    manualUrl: buildManualPrUrl(remote, sourceBranch, targetBranch),
  };
}

/**
 * Map a delivery outcome to the progress status and optional PR number.
 *
 * Pure function — used by the orchestrator to log progress after delivery.
 *
 * @param outcome - The delivery outcome.
 * @returns The progress status and optional PR number.
 */
export function progressForOutcome(outcome: DeliveryOutcome): {
  readonly status: ProgressStatus;
  readonly prNumber?: number;
} {
  switch (outcome.type) {
    case 'created':
      return { status: 'PR_CREATED', prNumber: outcome.number };
    case 'local':
      return { status: 'LOCAL' };
    case 'exists':
    case 'failed':
    case 'not_attempted':
    case 'unsupported':
      return { status: 'PUSHED' };
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}
