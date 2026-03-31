/**
 * Hook output builders.
 *
 * Pure data constructors for the JSON shapes Claude Code expects
 * from PreToolUse (allow/deny) and PostToolUse (context injection) hooks.
 *
 * PreToolUse hooks use the `hookSpecificOutput` envelope with
 * `permissionDecision` to control tool execution.
 */
import type { HookContextOutput, PreToolUseResult } from '../types.js';

/**
 * Build a PreToolUse allow response.
 *
 * @returns A hook output that allows the tool call to proceed.
 */
export function approve(): PreToolUseResult {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
    },
  };
}

/**
 * Build a PreToolUse deny response.
 *
 * @param reason - Human-readable explanation shown to the user.
 * @returns A hook output that blocks the tool call with a reason.
 */
export function block(reason: string): PreToolUseResult {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

/**
 * Build a context injection response for PostToolUse and other hooks.
 *
 * @param eventName - The hook event name (e.g. `'PostToolUse'`).
 * @param message - The context string to inject into the conversation.
 * @returns A nested output object Claude Code reads for context injection.
 */
export function contextOutput(
  eventName: string,
  message: string,
): HookContextOutput {
  return {
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: message,
    },
  };
}
