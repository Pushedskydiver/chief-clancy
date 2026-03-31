import { describe, expect, it } from 'vitest';

import { approve, block, contextOutput } from './hook-output.js';

describe('approve', () => {
  it('returns an allow decision in hookSpecificOutput envelope', () => {
    expect(approve()).toStrictEqual({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
      },
    });
  });
});

describe('block', () => {
  it('returns a deny decision with the given reason', () => {
    expect(block('credentials detected')).toStrictEqual({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'credentials detected',
      },
    });
  });
});

describe('contextOutput', () => {
  it('returns the nested hook output structure', () => {
    const result = contextOutput('PostToolUse', 'context is running low');

    expect(result).toStrictEqual({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: 'context is running low',
      },
    });
  });
});
