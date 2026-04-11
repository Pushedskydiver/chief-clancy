/**
 * Readiness invoker — spawn Claude with the rubric prompt and
 * parse the fenced JSON verdict from stdout.
 *
 * Reuses the `-p --dangerously-skip-permissions` pattern from
 * cli-bridge.ts for autonomous operation.
 */
import type { SpawnSyncFn } from '../types/index.js';
import type { ReadinessVerdict } from './types.js';

import { safeParseVerdict } from './parse-verdict.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type InvokeOpts = {
  /** The readiness rubric markdown content. */
  readonly rubric: string;
  /** Ticket identifier (e.g. `'PROJ-42'`). */
  readonly ticketId: string;
  /** Ticket title. */
  readonly ticketTitle: string;
  /** Ticket description body. */
  readonly ticketDescription: string;
  /** Absolute path to the project root. */
  readonly projectRoot: string;
  /** Injected spawn function. */
  readonly spawn: SpawnSyncFn;
  /** Optional model override. */
  readonly model?: string;
};

type InvokeResult =
  | { readonly ok: true; readonly verdict: ReadinessVerdict }
  | { readonly ok: false; readonly error: string };

// ─── Prompt builder ─────────────────────────────────────────────────────────

function buildPrompt(opts: InvokeOpts): string {
  return `${opts.rubric}

---

## Ticket to grade

- **id**: ${opts.ticketId}
- **title**: ${opts.ticketTitle}
- **description**: ${opts.ticketDescription}
- **repoRoot**: ${opts.projectRoot}

Grade this ticket now.`;
}

// ─── Invoker ────────────────────────────────────────────────────────────────

/**
 * Spawn a Claude process to grade a ticket against the readiness rubric.
 *
 * @param opts - Rubric, ticket data, and injected spawn.
 * @returns Parsed verdict or error.
 */
export function invokeReadinessGrade(opts: InvokeOpts): InvokeResult {
  const base = ['-p', '--dangerously-skip-permissions'] as const;
  const args = opts.model ? [...base, '--model', opts.model] : [...base];

  const result = opts.spawn('claude', args, {
    input: buildPrompt(opts),
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const detail = result.stderr?.trim();
    const message = detail
      ? `Claude process failed (exit ${result.status}): ${detail}`
      : `Claude process failed (exit ${result.status})`;
    return { ok: false, error: message };
  }

  return safeParseVerdict(result.stdout ?? '');
}
