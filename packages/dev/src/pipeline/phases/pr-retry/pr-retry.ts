/**
 * PR retry — retry PR creation for tickets that were pushed
 * but failed to create a PR.
 *
 * Handles network hiccups during PR creation. The branch is already
 * on the remote — we just need to create the PR/MR.
 *
 * Best-effort: never blocks the pipeline. Returns structured results
 * — no console output.
 */
import type { RunContext } from '../../context.js';
import type { ProgressStatus } from '@chief-clancy/core/types/progress.js';
import type {
  PrCreationResult,
  RemoteInfo,
} from '@chief-clancy/core/types/remote.js';
import type { ProgressEntry } from '~/d/lifecycle/progress/progress.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Status of a single retry attempt. */
type RetryStatus = 'created' | 'exists' | 'failed' | 'skipped' | 'unsupported';

/** Result of a single retry attempt. */
type RetryResultEntry = {
  readonly key: string;
  readonly status: RetryStatus;
  readonly prNumber?: number;
};

/** Structured result of the pr-retry phase. */
type PrRetryResult = {
  readonly results: readonly RetryResultEntry[];
};

/** Progress append function (pre-wired with fs + projectRoot by terminal). */
type AppendFn = (opts: {
  readonly key: string;
  readonly summary: string;
  readonly status: ProgressStatus;
  readonly prNumber?: number;
  readonly parent?: string;
}) => void;

/** Injected dependencies for pr-retry. */
export type PrRetryDeps = {
  /** Find PUSHED entries that lack a PR_CREATED. */
  readonly findRetryable: (ctx: RunContext) => readonly ProgressEntry[];
  /** Detect the git remote. Pre-wired with exec. */
  readonly detectRemote: (ctx: RunContext) => RemoteInfo;
  /** Attempt PR creation for one entry. Pre-wired with exec/fetchFn/config. */
  readonly retryEntry: (
    entry: ProgressEntry,
    remote: RemoteInfo,
    ctx: RunContext,
  ) => Promise<PrCreationResult | undefined>;
  /** Append a progress entry. Pre-wired with progressFs + projectRoot. */
  readonly appendProgress: AppendFn;
};

// ─── Phase ───────────────────────────────────────────────────────────────────

/**
 * Retry PR creation for pushed tickets that lack a PR.
 *
 * Best-effort — errors are caught and an empty result is returned.
 * Never blocks the pipeline.
 *
 * @param ctx - Pipeline context (requires config from preflight).
 * @param deps - Injected dependencies.
 * @returns Structured result with per-entry retry outcomes.
 */
export async function prRetry(
  ctx: RunContext,
  deps: PrRetryDeps,
): Promise<PrRetryResult> {
  try {
    return await retryAll(ctx, deps);
  } catch {
    return { results: [] };
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Normalise parent — treat `'none'` as `undefined`. */
function normaliseParent(parent: string | undefined): string | undefined {
  return parent && parent !== 'none' ? parent : undefined;
}

/** Classify a PR creation result into a retry status. */
function classifyResult(pr: PrCreationResult | undefined): RetryStatus {
  if (pr?.ok) return 'created';
  if (pr && !pr.ok && pr.alreadyExists) return 'exists';
  if (pr && !pr.ok) return 'failed';
  return 'skipped';
}

/** Run retry logic for all retryable entries. */
async function retryAll(
  ctx: RunContext,
  deps: PrRetryDeps,
): Promise<PrRetryResult> {
  const retryable = deps.findRetryable(ctx);

  if (retryable.length === 0) return { results: [] };

  const remote = deps.detectRemote(ctx);

  if (remote.host === 'none' || remote.host === 'unknown') {
    return handleUnsupportedRemote(retryable, deps);
  }

  const retryOne = async (entry: ProgressEntry): Promise<RetryResultEntry> => {
    const pr = await deps.retryEntry(entry, remote, ctx);
    const status = classifyResult(pr);
    const parent = normaliseParent(entry.parent);

    if (status === 'created' || status === 'exists') {
      // Note: prNumber is undefined for 'exists' — PrCreationFailure
      // doesn't carry the PR number. The progress entry still logs
      // PR_CREATED to prevent infinite retry loops.
      deps.appendProgress({
        key: entry.key,
        summary: entry.summary,
        status: 'PR_CREATED',
        prNumber: pr?.ok ? pr.number : undefined,
        parent,
      });
    }

    return {
      key: entry.key,
      status,
      ...(pr?.ok && { prNumber: pr.number }),
    };
  };

  const results = await Promise.all(retryable.map(retryOne));

  return { results };
}

/** Mark all entries as unsupported and log PR_CREATED to prevent infinite retry. */
function handleUnsupportedRemote(
  entries: readonly ProgressEntry[],
  deps: PrRetryDeps,
): PrRetryResult {
  const results = entries.map((entry) => {
    deps.appendProgress({
      key: entry.key,
      summary: entry.summary,
      status: 'PR_CREATED',
      parent: normaliseParent(entry.parent),
    });

    return { key: entry.key, status: 'unsupported' as const };
  });

  return { results };
}
