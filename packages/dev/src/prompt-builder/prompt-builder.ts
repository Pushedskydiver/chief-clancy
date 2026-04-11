/**
 * Prompt builder for ticket implementation.
 *
 * Generates prompt strings piped to the Claude CLI for autonomous
 * ticket implementation and rework cycles.
 */
import type { BoardProvider } from '@chief-clancy/core';

/**
 * Get the board-specific label for the ticket type.
 *
 * @param provider - The board provider.
 * @returns The label used in prompts (e.g., `'Jira ticket'`, `'GitHub Issue'`).
 */
export function ticketLabel(provider: BoardProvider): string {
  switch (provider) {
    case 'jira':
      return 'Jira ticket';
    case 'github':
      return 'GitHub Issue';
    case 'linear':
      return 'Linear issue';
    case 'shortcut':
      return 'Shortcut story';
    case 'notion':
      return 'Notion page';
    case 'azdo':
      return 'Azure DevOps work item';
  }
}

type PromptInput = {
  readonly provider: BoardProvider;
  readonly key: string;
  readonly title: string;
  readonly description: string;
  /** Epic/milestone/parent info string (e.g., `'PROJ-100'`, `'Sprint 3'`). */
  readonly parentInfo: string;
  /** Blocker info string (e.g., `'Blocked by: PROJ-99, PROJ-98'`). */
  readonly blockers?: string;
  /** When true, enforce test-driven development (red-green-refactor). */
  readonly tdd?: boolean;
};

const TDD_BLOCK = `
## Test-Driven Development

You MUST follow the red-green-refactor cycle for every behaviour change:

1. **Red** — Write a failing test that describes the desired behaviour.
   Run the test suite and confirm the new test fails.
2. **Green** — Write the minimum code to make the failing test pass.
   Do not add behaviour beyond what the test requires.
3. **Refactor** — Clean up the implementation while keeping all tests green.
   Look for duplication, unclear names, or unnecessary complexity.

Repeat for each behaviour. Do not write implementation code without a failing test first.
Design interfaces for testability — prefer pure functions and thin boundaries
so modules are easy to test in isolation.`;

function parentLabel(provider: BoardProvider): string {
  switch (provider) {
    case 'github':
      return 'Milestone';
    case 'notion':
      return 'Parent page';
    case 'jira':
    case 'linear':
    case 'shortcut':
    case 'azdo':
      return 'Epic';
  }
}

/**
 * Build the full Claude prompt for implementing a ticket.
 *
 * @param input - The ticket data for the prompt.
 * @returns The complete prompt string.
 */
export function buildPrompt(input: PromptInput): string {
  const label = ticketLabel(input.provider);
  const pLabel = parentLabel(input.provider);
  const isGitHub = input.provider === 'github';
  const ticketWord = isGitHub ? 'issue' : 'ticket';
  const hasBlockers = input.blockers && !isGitHub;
  const blockerLine = hasBlockers ? `\nBlockers: ${input.blockers}` : '';

  return `You are implementing ${label} ${input.key}.

${isGitHub ? 'Title' : 'Summary'}: ${input.title}
${pLabel}: ${input.parentInfo}${blockerLine}

Description:
${input.description}

Step 0 — Executability check (do this before any git or file operation):
Read the ${isGitHub ? 'issue title and description' : 'ticket summary and description'} above. Can this ${ticketWord} be implemented entirely
as a code change committed to this repo? Consult the 'Executability check' section of
CLAUDE.md for the full list of skip conditions.

If you must SKIP this ${ticketWord}:
1. Output: ⚠ Skipping [${input.key}]: {one-line reason}
2. Output: Ticket skipped — update it to be codebase-only work, then re-run.
3. Append to .clancy/progress.txt: YYYY-MM-DD HH:MM | ${input.key} | {reason} | SKIPPED
4. Stop — no branches, no file changes, no git operations.

If the ${ticketWord} IS implementable, continue:${input.tdd ? TDD_BLOCK : ''}
1. If the directory .clancy/docs/ exists, read: STACK.md, ARCHITECTURE.md, CONVENTIONS.md, GIT.md, DEFINITION-OF-DONE.md, CONCERNS.md
   Also read if relevant to this ticket: INTEGRATIONS.md (external APIs/services/auth), TESTING.md (tests/specs/coverage), DESIGN-SYSTEM.md (UI/components/styles), ACCESSIBILITY.md (accessibility/ARIA/WCAG)
   If .clancy/docs/ does not exist, work with what you find in the codebase directly.
2. If .clancy/docs/GIT.md exists, follow its conventions exactly. Otherwise, follow the repository's existing git conventions.
3. Implement the ${ticketWord} fully
4. Commit your work following GIT.md if available; otherwise match the existing commit style in the repository history.
5. When done, confirm you are finished.`;
}

type ReworkPromptInput = {
  readonly provider: BoardProvider;
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly feedbackComments: readonly string[];
  /** Git diff or git log output from the previous implementation. */
  readonly previousContext?: string;
  /** When true, enforce test-driven development (red-green-refactor). */
  readonly tdd?: boolean;
};

/**
 * Build the Claude prompt for reworking a ticket based on reviewer feedback.
 *
 * @param input - The rework ticket data and feedback.
 * @returns The complete rework prompt string.
 */
function formatFeedback(comments: readonly string[]): string {
  if (comments.length === 0) {
    return 'No reviewer comments found. Review the existing implementation and fix any issues.';
  }

  return comments
    .map((comment, index) => `${index + 1}. ${comment}`)
    .join('\n');
}

export function buildReworkPrompt(input: ReworkPromptInput): string {
  const feedbackSection = formatFeedback(input.feedbackComments);

  const previousSection = input.previousContext
    ? `\n\n## Previous Implementation\n\n\`\`\`\n${input.previousContext}\n\`\`\``
    : '';

  return `You are fixing review feedback on [${input.key}] ${input.title}.

Description:
${input.description}

## Reviewer Feedback

${feedbackSection}${previousSection}

Address the specific feedback above. Don't re-implement unrelated areas. Focus only on what was flagged.${input.tdd ? TDD_BLOCK : ''}

Steps:
1. If the directory .clancy/docs/ exists, read: STACK.md, ARCHITECTURE.md, CONVENTIONS.md, GIT.md, DEFINITION-OF-DONE.md, CONCERNS.md
   Also read if relevant to this ticket: INTEGRATIONS.md (external APIs/services/auth), TESTING.md (tests/specs/coverage), DESIGN-SYSTEM.md (UI/components/styles), ACCESSIBILITY.md (accessibility/ARIA/WCAG)
   If .clancy/docs/ does not exist, work with what you find in the codebase directly.
2. If .clancy/docs/GIT.md exists, follow its conventions exactly. Otherwise, follow the repository's existing git conventions.
3. Fix the issues identified in the reviewer feedback
4. Commit your work following GIT.md if available; otherwise match the existing commit style in the repository history.
5. When done, confirm you are finished.`;
}
