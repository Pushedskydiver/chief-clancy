/**
 * Parse readiness-related flags from argv.
 *
 * Handles `--bypass-readiness` (requires `--reason=...`) and
 * validates that bypass is not combined with AFK mode.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

type BypassResult = {
  readonly ok: true;
  readonly bypass: true;
  readonly reason: string;
};

type NoBypassResult = {
  readonly ok: true;
  readonly bypass: false;
};

type ErrorResult = {
  readonly ok: false;
  readonly error: { readonly kind: 'unknown'; readonly message: string };
};

type ReadinessFlagsResult = BypassResult | NoBypassResult | ErrorResult;

// ─── Parser ─────────────────────────────────────────────────────────────────

function extractReason(argv: readonly string[]): string | undefined {
  const equalsArg = argv.find((a) => a.startsWith('--reason='));

  if (equalsArg) {
    return equalsArg.slice('--reason='.length);
  }

  const flagIdx = argv.indexOf('--reason');

  if (flagIdx !== -1 && flagIdx + 1 < argv.length) {
    return argv[flagIdx + 1];
  }

  return undefined;
}

/**
 * Parse readiness flags from argv.
 *
 * @param argv - Process arguments (flags only, no node/script/ticket-key).
 * @param isAfk - Whether the runner is in AFK mode.
 * @returns Parsed flags or error.
 */
export function parseReadinessFlags(
  argv: readonly string[],
  isAfk: boolean,
): ReadinessFlagsResult {
  const hasBypass = argv.includes('--bypass-readiness');

  if (!hasBypass) {
    return { ok: true, bypass: false };
  }

  if (isAfk) {
    return {
      ok: false,
      error: {
        kind: 'unknown',
        message: '--bypass-readiness cannot be combined with --afk',
      },
    };
  }

  const reason = extractReason(argv);

  if (!reason?.trim()) {
    return {
      ok: false,
      error: {
        kind: 'unknown',
        message: '--bypass-readiness requires --reason="<reason>"',
      },
    };
  }

  return { ok: true, bypass: true, reason };
}
