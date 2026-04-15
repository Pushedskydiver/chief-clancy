/**
 * Build-label resolution — shared between dep-factory wiring and deliver-phase.
 *
 * Extracted to break the dep-factory ↔ deliver-phase cycle.
 */
import type { RunContext } from '../pipeline/context.js';

/** Default build-queue label when no env var is configured. */
const DEFAULT_BUILD_LABEL = 'clancy:build';

/**
 * Resolve the build label: CLANCY_LABEL_BUILD → CLANCY_LABEL → default.
 *
 * @param ctx - Pipeline context (config may be undefined before preflight).
 * @returns The resolved build label string.
 */
export function resolveBuildLabel(ctx: RunContext): string {
  const env = ctx.config?.env;
  return env?.CLANCY_LABEL_BUILD ?? env?.CLANCY_LABEL ?? DEFAULT_BUILD_LABEL;
}
