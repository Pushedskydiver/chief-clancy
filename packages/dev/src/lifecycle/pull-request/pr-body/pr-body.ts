/**
 * PR/MR body builder.
 *
 * Constructs the pull request description with a link back to the
 * board ticket and a Clancy footer.
 */
import type { BoardConfig } from '@chief-clancy/core/schemas/env/env.js';
import type { Ticket } from '@chief-clancy/core/types/index.js';
import type { ProgressEntry } from '~/d/lifecycle/progress/progress.js';

/** Epic context for child PRs targeting an epic/milestone branch. */
export type EpicContext = {
  /** Parent epic key (e.g., `'#49'`, `'PROJ-100'`). */
  readonly parentKey: string;
  /** Number of sibling tickets already delivered to the epic branch. */
  readonly siblingsDelivered: number;
  /** Target epic branch name (e.g., `'milestone/49'`). */
  readonly epicBranch: string;
};

/** Options for {@link buildPrBody}. */
type BuildPrBodyOpts = {
  readonly config: BoardConfig;
  readonly ticket: Ticket;
  readonly targetBranch?: string;
  readonly verificationWarning?: string;
  readonly singleChildParent?: string;
  readonly epicContext?: EpicContext;
};

/** Options for {@link buildEpicPrBody}. */
type BuildEpicPrBodyOpts = {
  readonly epicKey: string;
  readonly epicTitle: string;
  readonly childEntries: readonly ProgressEntry[];
  readonly provider?: string;
};

/**
 * Check whether a target branch is an epic or milestone branch.
 *
 * @param targetBranch - The branch the PR targets.
 * @returns `true` if it's an epic (`epic/`) or milestone (`milestone/`) branch.
 */
export function isEpicBranch(targetBranch: string): boolean {
  return (
    targetBranch.startsWith('epic/') || targetBranch.startsWith('milestone/')
  );
}

/**
 * Build the PR/MR body for a ticket.
 *
 * Includes a link back to the board ticket (auto-close for GitHub Issues
 * when targeting the base branch, or "Part of" when targeting an epic branch)
 * and a Clancy attribution footer.
 *
 * @param opts - Build options including config, ticket, and optional context.
 * @returns The PR body as a markdown string.
 */
export function buildPrBody(opts: BuildPrBodyOpts): string {
  const { config, ticket, targetBranch, verificationWarning } = opts;
  const { singleChildParent, epicContext } = opts;
  const isEpic = targetBranch ? isEpicBranch(targetBranch) : false;

  const sections = [
    ...epicBannerLines(epicContext, isEpic),
    ...ticketReferenceLines({ config, ticket, isEpic, singleChildParent }),
    '',
    ...descriptionLines(ticket.description),
    ...verificationLines(verificationWarning),
    ...footerLines(),
  ];

  return sections.join('\n');
}

/**
 * Build the PR body for the final epic PR (epic branch → base branch).
 *
 * Lists all child tickets with their PR numbers for traceability.
 * For GitHub, includes `Closes` keywords to auto-close child issues
 * and the parent epic when the PR is merged to the default branch.
 *
 * @param opts - Build options including epic key, title, children, and provider.
 * @returns The epic PR body as a markdown string.
 */
export function buildEpicPrBody(opts: BuildEpicPrBodyOpts): string {
  const { epicKey, epicTitle, childEntries, provider } = opts;

  const childLines = childEntries.map((entry) => {
    const prRef = entry.prNumber ? ` (#${entry.prNumber})` : '';
    return `- ${entry.key} — ${entry.summary}${prRef}`;
  });

  const closesLines =
    provider === 'github' ? githubClosesLines(epicKey, childEntries) : [];

  const sections = [
    `## ${epicKey} — ${epicTitle}`,
    '',
    '### Children',
    '',
    ...childLines,
    ...closesLines,
    '',
    '---',
    '*Created by [Clancy](https://github.com/Pushedskydiver/chief-clancy)*',
  ];

  return sections.join('\n');
}

// ─── private helpers ────────────────────────────────────────────────────────

function epicBannerLines(
  epic: EpicContext | undefined,
  isEpic: boolean,
): readonly string[] {
  if (!epic || !isEpic) return [];

  const delivered = epic.siblingsDelivered;
  const deliveredText =
    delivered === 0
      ? 'No siblings delivered yet'
      : `${delivered} sibling${delivered === 1 ? '' : 's'} previously delivered to \`${epic.epicBranch}\``;

  return [
    `## Part of epic ${epic.parentKey}`,
    deliveredText,
    '',
    `> This PR targets \`${epic.epicBranch}\`. A final epic PR will be created when all children are complete.`,
    '',
  ];
}

/** Options for {@link ticketReferenceLines}. */
type TicketRefOpts = {
  readonly config: BoardConfig;
  readonly ticket: Ticket;
  readonly isEpic: boolean;
  readonly singleChildParent?: string;
};

function ticketReferenceLines(opts: TicketRefOpts): readonly string[] {
  const { config, ticket, isEpic, singleChildParent } = opts;

  switch (config.provider) {
    case 'github': {
      const ref = isEpic ? `Part of ${ticket.key}` : `Closes ${ticket.key}`;
      const parentClose =
        singleChildParent && !isEpic ? [`Closes ${singleChildParent}`] : [];
      return [ref, ...parentClose];
    }
    case 'jira':
      return [
        `**Jira:** [${ticket.key}](${config.env.JIRA_BASE_URL}/browse/${ticket.key})`,
      ];
    case 'linear':
      return [`**Linear:** ${ticket.key}`];
    case 'shortcut':
    case 'notion':
    case 'azdo':
      return [`**Ticket:** ${ticket.key}`];
  }
}

function descriptionLines(description: string): readonly string[] {
  if (!description) return [];
  return ['## Description', '', description, ''];
}

function verificationLines(warning: string | undefined): readonly string[] {
  if (!warning) return [];
  return [
    '## ⚠ Verification Warning',
    '',
    warning,
    '',
    'This PR may need manual fixes before merging.',
    '',
  ];
}

const FOOTER = `---
*Created by [Clancy](https://github.com/Pushedskydiver/chief-clancy)*

---
<details>
<summary><strong>Rework instructions</strong> (click to expand)</summary>

To request changes:
- **Code comments** — leave inline comments on specific lines. These are always picked up automatically.
- **General feedback** — reply with a comment starting with \`Rework:\` followed by what needs fixing. Comments without the \`Rework:\` prefix are treated as discussion.

Example: \`Rework: The form validation doesn't handle empty passwords\`

</details>`;

function footerLines(): readonly string[] {
  return FOOTER.split('\n');
}

function githubClosesLines(
  epicKey: string,
  childEntries: readonly ProgressEntry[],
): readonly string[] {
  const childKeys = childEntries
    .map((e) => e.key)
    .filter((k) => k.startsWith('#'));

  const epicPrefix = epicKey.startsWith('#') ? [epicKey] : [];
  const issueKeys = [...epicPrefix, ...childKeys];

  if (issueKeys.length === 0) return [];
  return ['', '### Closes', '', issueKeys.map((k) => `Closes ${k}`).join(', ')];
}
