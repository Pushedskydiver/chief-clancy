/**
 * PreToolUse hook: branch guard.
 *
 * Checks Bash tool commands for dangerous git operations: force push,
 * push to protected branches, reset --hard, clean -f, checkout -- .,
 * restore ., and branch -D. Blocks the tool call with a reason if
 * a dangerous operation is detected.
 *
 * Disabled when `CLANCY_BRANCH_GUARD=false`.
 * Best-effort: any failure approves silently.
 */
import { readFileSync } from 'node:fs';

import { approve, block } from '../shared/hook-output/index.js';
import { readPreToolUseInput } from '../shared/stdin-reader/index.js';
import { buildProtectedBranches, checkCommand } from './check-command.js';

try {
  const guardDisabled = process.env.CLANCY_BRANCH_GUARD === 'false';

  if (guardDisabled) {
    console.log(JSON.stringify(approve()));
    process.exit(0);
  }

  const event = readPreToolUseInput({ argv: process.argv, readFileSync });
  const toolName = event.tool_name ?? '';
  // Safe: tool_input is untyped on HookEvent — fields validated individually below
  const toolInput = event.tool_input ?? {};
  const command =
    typeof toolInput.command === 'string' ? toolInput.command : '';

  const isBashTool = toolName === 'Bash';

  if (!isBashTool) {
    console.log(JSON.stringify(approve()));
    process.exit(0);
  }

  const branches = buildProtectedBranches(process.env.CLANCY_BASE_BRANCH);
  const reason = checkCommand(command, branches);

  if (reason) {
    console.log(JSON.stringify(block(reason)));
  } else {
    console.log(JSON.stringify(approve()));
  }
} catch {
  // Hooks must never crash — an unhandled error here would surface as
  // a Claude Code failure. Approve silently so the tool call proceeds.
  console.log(JSON.stringify(approve()));
}
