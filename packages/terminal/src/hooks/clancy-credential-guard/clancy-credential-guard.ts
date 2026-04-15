/**
 * PreToolUse hook: credential guard.
 *
 * Scans content written by Write, Edit, and MultiEdit tools for known
 * credential patterns (API keys, tokens, private keys, connection strings).
 * Blocks the tool call if credentials are detected, unless the target
 * file is in the allow list (e.g. `.env.example`).
 *
 * Best-effort: any failure approves silently.
 */
import { readFileSync } from 'node:fs';

import { approve, block } from '../shared/hook-output/hook-output.js';
import { readPreToolUseInput } from '../shared/stdin-reader/stdin-reader.js';
import {
  extractContent,
  isAllowedPath,
  scanForCredentials,
} from './scan-credentials.js';

try {
  const event = readPreToolUseInput({ argv: process.argv, readFileSync });
  const toolName = event.tool_name ?? '';
  // Safe: tool_input is untyped on HookEvent — fields validated individually below
  const toolInput = event.tool_input ?? {};
  const filePath =
    typeof toolInput.file_path === 'string' ? toolInput.file_path : '';

  const content = extractContent(toolName, toolInput);
  const isWriteTool = content !== null;
  const isAllowed = filePath !== '' && isAllowedPath(filePath);

  if (!isWriteTool || isAllowed) {
    console.log(JSON.stringify(approve()));
    process.exit(0);
  }

  const matches = scanForCredentials(content);
  const hasCredentials = matches.length > 0;

  if (hasCredentials) {
    const list = matches.join(', ');
    const reason =
      `Credential guard: blocked writing to ${filePath}. ` +
      `Detected: ${list}. Move credentials to .clancy/.env instead.`;

    console.log(JSON.stringify(block(reason)));
  } else {
    console.log(JSON.stringify(approve()));
  }
} catch {
  // Hooks must never crash — an unhandled error here would surface as
  // a Claude Code failure. Approve silently so the tool call proceeds.
  console.log(JSON.stringify(approve()));
}
