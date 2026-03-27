/**
 * Hook output builders.
 *
 * Pure data constructors for the JSON shapes Claude Code expects
 * from PreToolUse (approve/block) and PostToolUse (context injection) hooks.
 */
import type { HookContextOutput, PreToolUseResult } from '../types.js';

/**
 * Build a PreToolUse approve response.
 *
 * @returns A decision object that allows the tool call to proceed.
 */
export function approve(): PreToolUseResult {
  return { decision: 'approve' };
}

/**
 * Build a PreToolUse block response.
 *
 * @param reason - Human-readable explanation shown to the user.
 * @returns A decision object that blocks the tool call.
 */
export function block(reason: string): PreToolUseResult {
  return { decision: 'block', reason };
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
