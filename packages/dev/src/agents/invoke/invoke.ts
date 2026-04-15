/**
 * Readiness invoker — spawn Claude with the rubric prompt and
 * parse the fenced JSON verdict from stdout.
 *
 * Reuses the `-p --dangerously-skip-permissions` pattern from
 * cli-bridge.ts for autonomous operation.
 */
import type { SpawnSyncFn } from '../../types/spawn.js';
import type { ReadinessVerdict } from '../types/types.js';

import { safeParseVerdict } from '../parse-verdict/parse-verdict.js';

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
  // --bare skips hooks/skills/plugins/MCP/auto-memory discovery.
  // --output-format json + --json-schema deferred to PR 10 pending
  // composability smoke test (plan Q-v3-1).
  const base = ['-p', '--bare', '--dangerously-skip-permissions'] as const;
  const args = opts.model ? [...base, '--model', opts.model] : [...base];

  const result = opts.spawn('claude', args, {
    input: buildPrompt(opts),
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  if (result.error) {
    return { ok: false, error: `Claude spawn failed: ${result.error.message}` };
  }

  if (result.signal) {
    return {
      ok: false,
      error: `Claude process killed by signal ${result.signal}`,
    };
  }

  if (result.status !== 0) {
    const detail = result.stderr?.trim();
    const exitInfo = `exit ${result.status ?? 'unknown'}`;
    const message = detail
      ? `Claude process failed (${exitInfo}): ${detail}`
      : `Claude process failed (${exitInfo})`;
    return { ok: false, error: message };
  }

  return safeParseVerdict(result.stdout ?? '');
}
