/**
 * Lightweight feasibility check — evaluates whether a ticket can be
 * implemented as pure code changes before creating branches or
 * transitioning board status.
 *
 * The Claude invocation is dependency-injected for testability.
 * Fails open: if Claude is unavailable or output is malformed the
 * ticket is assumed feasible so work is never silently blocked.
 */

/** Ticket metadata needed for a feasibility check. */
type FeasibilityTicket = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
};

/** Result of a feasibility check. */
type FeasibilityResult = {
  readonly feasible: boolean;
  readonly reason?: string;
};

/**
 * Build the feasibility evaluation prompt.
 *
 * @param ticket - The ticket to evaluate.
 * @returns The prompt string for Claude.
 */
export function buildFeasibilityPrompt(ticket: FeasibilityTicket): string {
  return [
    'You are evaluating whether a ticket can be implemented as pure code changes in a repository.',
    '',
    `Ticket: [${ticket.key}] ${ticket.title}`,
    'Description:',
    ticket.description,
    '',
    'Can this ticket be completed entirely through code changes committed to a git repository?',
    '',
    'Answer INFEASIBLE if the ticket requires ANY of:',
    '- Manual testing or configuration in external tools or admin panels',
    '- Access to external services, APIs, or platforms not available in the codebase',
    '- Physical, hardware, or infrastructure changes',
    '- Design assets that do not yet exist',
    '- Deployment or infrastructure changes outside the repository',
    '- Human judgment calls that require stakeholder input',
    '',
    'Answer with exactly one line in this format:',
    'FEASIBLE',
    'or',
    'INFEASIBLE: one-line reason',
    '',
    'Do not include any other text.',
  ].join('\n');
}

/**
 * Parse raw Claude output into a feasibility result.
 *
 * Fails open — malformed or empty output is treated as feasible.
 *
 * @param stdout - The raw stdout from Claude.
 * @returns The parsed feasibility result.
 */
export function parseFeasibilityResponse(stdout: string): FeasibilityResult {
  const lines = stdout.trim().split('\n');
  const line = (lines.at(-1) ?? '').trim();

  if (/^INFEASIBLE/i.test(line)) {
    const reason = line.replace(/^INFEASIBLE:?\s*/i, '').trim() || undefined;
    return { feasible: false, reason };
  }

  return { feasible: true };
}

/** Invoke Claude in print mode and return stdout + success flag. */
type InvokeClaude = (
  prompt: string,
  model?: string,
) => { readonly stdout: string; readonly ok: boolean };

/**
 * Run a feasibility check for a ticket.
 *
 * Fails open — if Claude fails or returns malformed output, the
 * ticket is assumed feasible to avoid blocking work.
 *
 * @param invoke - Injected Claude print-mode invocation.
 * @param ticket - The ticket to evaluate.
 * @param model - Optional model override (e.g. `'sonnet'`).
 * @returns A result indicating feasibility and an optional reason.
 */
export function checkFeasibility(
  invoke: InvokeClaude,
  ticket: FeasibilityTicket,
  model?: string,
): FeasibilityResult {
  const prompt = buildFeasibilityPrompt(ticket);
  const { stdout, ok } = invoke(prompt, model);

  if (!ok) return { feasible: true };

  return parseFeasibilityResponse(stdout);
}
