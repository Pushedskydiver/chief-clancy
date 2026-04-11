/**
 * Tests for readiness flag parsing from argv.
 */
import { describe, expect, it } from 'vitest';

import { parseReadinessFlags } from './readiness-flags.js';

describe('parseReadinessFlags', () => {
  it('returns no bypass when no flags present', () => {
    const result = parseReadinessFlags([], false);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bypass).toBe(false);
    }
  });

  it('returns bypass with reason when both flags present', () => {
    const result = parseReadinessFlags(
      ['--bypass-readiness', '--reason=testing this'],
      false,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bypass).toBe(true);
      expect(result.reason).toBe('testing this');
    }
  });

  it('returns error when --bypass-readiness without --reason', () => {
    const result = parseReadinessFlags(['--bypass-readiness'], false);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('--reason');
    }
  });

  it('returns error when --bypass-readiness combined with afk mode', () => {
    const result = parseReadinessFlags(
      ['--bypass-readiness', '--reason=test'],
      true,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('--afk');
    }
  });

  it('parses --reason with equals sign', () => {
    const result = parseReadinessFlags(
      ['--bypass-readiness', '--reason=my reason here'],
      false,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reason).toBe('my reason here');
    }
  });

  it('parses --reason as separate arg', () => {
    const result = parseReadinessFlags(
      ['--bypass-readiness', '--reason', 'my reason here'],
      false,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reason).toBe('my reason here');
    }
  });

  it('returns error when --reason is empty', () => {
    const result = parseReadinessFlags(
      ['--bypass-readiness', '--reason='],
      false,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('--reason');
    }
  });

  it('ignores unrelated flags', () => {
    const result = parseReadinessFlags(['--dry-run', '--verbose'], false);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bypass).toBe(false);
    }
  });
});
