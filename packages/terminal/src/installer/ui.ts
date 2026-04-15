/**
 * Installer UI — banner and success message.
 */

import { blue, bold, cyan, dim, green } from '~/t/shared/ansi.js';

/** A single slash command entry: [command, description]. */
type Command = readonly [string, string];

/** A command group with optional role gating. */
type CommandGroup = {
  readonly name: string;
  readonly roleKey: string | null;
  readonly commands: readonly Command[];
};

// Keep in sync with the slash command registry once it exists (see docs/decisions/architecture/package-evolution.md).
const COMMAND_GROUPS: readonly CommandGroup[] = [
  {
    name: 'Strategist',
    roleKey: 'strategist',
    commands: [
      ['/clancy:brief', 'Generate a strategic brief for a feature'],
      ['/clancy:approve-brief', 'Convert brief into board tickets'],
    ],
  },
  {
    name: 'Planner',
    roleKey: 'planner',
    commands: [
      ['/clancy:plan', 'Refine backlog tickets into plans'],
      ['/clancy:approve-plan', 'Promote plan to ticket description'],
    ],
  },
  {
    name: 'Implementer',
    roleKey: null,
    commands: [
      ['/clancy:implement', 'Pick up one ticket and stop'],
      ['/clancy:autopilot', 'Run Clancy in loop mode'],
      ['/clancy:dry-run', 'Preview next ticket without changes'],
    ],
  },
  {
    name: 'Reviewer',
    roleKey: null,
    commands: [
      ['/clancy:review', 'Score next ticket and get recommendations'],
      ['/clancy:status', 'Show next tickets without running'],
      ['/clancy:logs', 'Display progress log'],
    ],
  },
  {
    name: 'Setup & Maintenance',
    roleKey: null,
    commands: [
      ['/clancy:init', 'Set up Clancy in your project'],
      ['/clancy:map-codebase', 'Scan codebase with 5 parallel agents'],
      ['/clancy:settings', 'View and change configuration'],
      ['/clancy:doctor', 'Diagnose your setup'],
      ['/clancy:update-docs', 'Refresh codebase documentation'],
      ['/clancy:update-terminal', 'Update the full pipeline'],
      ['/clancy:uninstall-terminal', 'Remove the full Clancy pipeline'],
      ['/clancy:help', 'Show all commands'],
    ],
  },
];

const BANNER_LINES: readonly string[] = [
  '  ██████╗██╗      █████╗ ███╗   ██╗ ██████╗██╗   ██╗',
  ' ██╔════╝██║     ██╔══██╗████╗  ██║██╔════╝╚██╗ ██╔╝',
  ' ██║     ██║     ███████║██╔██╗ ██║██║      ╚████╔╝ ',
  ' ██║     ██║     ██╔══██║██║╚██╗██║██║       ╚██╔╝  ',
  ' ╚██████╗███████╗██║  ██║██║ ╚████║╚██████╗   ██║   ',
  '  ╚═════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝   ╚═╝  ',
];

/**
 * Print the Clancy ASCII banner and version info.
 *
 * @param version - The package version string to display.
 * @returns Nothing — output is written to stdout.
 */
export function printBanner(version: string): void {
  console.log('');
  BANNER_LINES.forEach((line) => console.log(blue(line)));
  console.log('');
  console.log(
    `  ${bold(`v${version}`)}${dim('  Autonomous, board-driven development for Claude Code.')}`,
  );
  console.log(
    dim(
      '  Named after Chief Clancy Wiggum. Built on the Ralph technique by Geoffrey Huntley.',
    ),
  );
}

/** Check whether a group should be shown for the given enabled roles. */
function isGroupVisible(
  group: CommandGroup,
  enabledRoles: ReadonlySet<string> | null,
): boolean {
  if (group.roleKey === null) return true;
  if (enabledRoles === null) return true;
  return enabledRoles.has(group.roleKey);
}

/** Column width for command names — keeps descriptions aligned. */
const CMD_COL_WIDTH = 27;

/** Format a single command line for display. */
function formatCommand([cmd, desc]: Command): string {
  return `      ${cyan(cmd.padEnd(CMD_COL_WIDTH))}  ${dim(desc)}`;
}

/** Print a single command group header and its commands. */
function printGroup(group: CommandGroup): void {
  console.log('');
  console.log(`    ${bold(group.name)}`);
  group.commands.forEach((cmd) => console.log(formatCommand(cmd)));
}

/**
 * Print the post-install success message with available commands.
 *
 * Command groups with a non-null `roleKey` are role-gated: they are shown only
 * when their role key is present in `enabledRoles`. Groups with `roleKey === null`
 * are always shown. Pass `null` for `enabledRoles` to disable role gating and show
 * all groups.
 *
 * @param enabledRoles - Role keys matching `CommandGroup.roleKey` (e.g. `"strategist"`), or `null` to show all groups.
 * @returns Nothing — output is written to stdout.
 */
export function printSuccess(enabledRoles: ReadonlySet<string> | null): void {
  console.log('');
  console.log(green('  ✓ Clancy installed successfully.'));
  console.log('');
  console.log('  Next steps:');
  console.log(dim('    1. Open a project in Claude Code'));
  console.log(`    2. Run: ${cyan('/clancy:init')}`);
  console.log('');
  console.log('  Commands available:');

  const visibleGroups = COMMAND_GROUPS.filter((g) =>
    isGroupVisible(g, enabledRoles),
  );
  visibleGroups.forEach(printGroup);

  console.log('');
}
