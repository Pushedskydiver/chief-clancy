/**
 * Shared progress types used across runner modules.
 *
 * Consolidates types that were previously in terminal's runner/shared/types.ts.
 */
import type { ProgressStatus } from '@chief-clancy/core';

/** Progress append function used by dep-factory and deliver-phase. */
export type AppendFn = (opts: {
  readonly key: string;
  readonly summary: string;
  readonly status: ProgressStatus;
  readonly prNumber?: number;
  readonly parent?: string;
  readonly ticketType?: string;
}) => void;
