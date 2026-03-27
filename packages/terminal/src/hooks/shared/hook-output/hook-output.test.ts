import { describe, expect, it } from 'vitest';

import { approve, block, contextOutput } from './hook-output.js';

describe('approve', () => {
  it('returns an approve decision with no reason', () => {
    expect(approve()).toStrictEqual({ decision: 'approve' });
  });
});

describe('block', () => {
  it('returns a block decision with the given reason', () => {
    expect(block('credentials detected')).toStrictEqual({
      decision: 'block',
      reason: 'credentials detected',
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
