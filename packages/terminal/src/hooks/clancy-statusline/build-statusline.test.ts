import { describe, expect, it } from 'vitest';

import {
  buildBridgeData,
  buildContextBar,
  buildStatusline,
  checkUpdateAvailable,
  normalizeContextUsage,
  readInstalledVersion,
  resolveCachePath,
} from './build-statusline.js';

/** Strip ANSI escape sequences using dynamic ESC to avoid no-control-regex. */
const ESC = String.fromCharCode(27);
function stripAnsi(s: string): string {
  return s.replaceAll(new RegExp(`${ESC}\\[[0-9;]*m`, 'g'), '');
}

// ---------------------------------------------------------------------------
// normalizeContextUsage
// ---------------------------------------------------------------------------

describe('normalizeContextUsage', () => {
  it('returns 0% used at full remaining (100%)', () => {
    const result = normalizeContextUsage(100);

    expect(result.usedPct).toBe(0);
  });

  it('returns 100% used at the auto-compact buffer (16.5%)', () => {
    const result = normalizeContextUsage(16.5);

    expect(result.usedPct).toBe(100);
  });

  it('clamps usableRemaining to 0 when below buffer', () => {
    const result = normalizeContextUsage(10);

    expect(result.usableRemaining).toBe(0);
    expect(result.usedPct).toBe(100);
  });

  it('returns roughly 50% used at midpoint', () => {
    // Midpoint between 16.5 and 100 is 58.25
    const result = normalizeContextUsage(58.25);

    expect(result.usedPct).toBe(50);
  });

  it('clamps usedPct to 0 at maximum remaining', () => {
    const result = normalizeContextUsage(100);

    expect(result.usedPct).toBe(0);
    expect(result.usableRemaining).toBe(100);
  });

  it('handles 0% remaining', () => {
    const result = normalizeContextUsage(0);

    expect(result.usedPct).toBe(100);
    expect(result.usableRemaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildBridgeData
// ---------------------------------------------------------------------------

describe('buildBridgeData', () => {
  it('includes session, raw remaining, normalised used, and timestamp', () => {
    const result = buildBridgeData('session-123', 100, 1700000000);

    expect(result.session_id).toBe('session-123');
    expect(result.remaining_percentage).toBe(100);
    expect(result.used_pct).toBe(0);
    expect(result.timestamp).toBe(1700000000);
  });

  it('normalises used_pct from raw remaining', () => {
    const result = buildBridgeData('s', 16.5, 0);

    expect(result.used_pct).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// buildContextBar
// ---------------------------------------------------------------------------

describe('buildContextBar', () => {
  it('applies green colour below 50%', () => {
    const bar = buildContextBar(30);

    expect(bar).toContain('\x1b[32m');
    expect(bar).toContain('30%');
  });

  it('applies yellow colour at 50%', () => {
    const bar = buildContextBar(50);

    expect(bar).toContain('\x1b[33m');
    expect(bar).toContain('50%');
  });

  it('applies orange colour at 65%', () => {
    const bar = buildContextBar(65);

    expect(bar).toContain('\x1b[38;5;208m');
    expect(bar).toContain('65%');
  });

  it('applies blinking red with skull at 80%', () => {
    const bar = buildContextBar(80);

    expect(bar).toContain('\x1b[5;31m');
    expect(bar).toContain('\u{1F480}');
    expect(bar).toContain('80%');
  });

  it('builds a 10-character bar', () => {
    const bar = buildContextBar(0);
    const stripped = stripAnsi(bar);

    expect(stripped).toContain('\u2591'.repeat(10));
  });

  it('fills proportional blocks', () => {
    const bar = buildContextBar(50);
    const stripped = stripAnsi(bar);

    expect(stripped).toContain('\u2588'.repeat(5));
    expect(stripped).toContain('\u2591'.repeat(5));
  });

  it('clamps bar width for values above 100', () => {
    const bar = buildContextBar(110);
    const stripped = stripAnsi(bar);
    const blockCount = [...stripped].filter((c) => c === '\u2588').length;

    expect(blockCount).toBe(10);
  });

  it('clamps bar width for negative values', () => {
    const bar = buildContextBar(-10);
    const stripped = stripAnsi(bar);

    expect(stripped).toContain('\u2591'.repeat(10));
  });
});

// ---------------------------------------------------------------------------
// checkUpdateAvailable
// ---------------------------------------------------------------------------

describe('checkUpdateAvailable', () => {
  it('returns true when cache has update_available: true', () => {
    const deps = {
      readFileSync: () => JSON.stringify({ update_available: true }),
    };

    expect(checkUpdateAvailable('/cache.json', deps)).toBe(true);
  });

  it('returns false when cache has update_available: false', () => {
    const deps = {
      readFileSync: () => JSON.stringify({ update_available: false }),
    };

    expect(checkUpdateAvailable('/cache.json', deps)).toBe(false);
  });

  it('returns false when cache file is missing', () => {
    const deps = {
      readFileSync: () => {
        throw new Error('ENOENT');
      },
    };

    expect(checkUpdateAvailable('/cache.json', deps)).toBe(false);
  });

  it('returns false for invalid JSON', () => {
    const deps = {
      readFileSync: () => 'not json',
    };

    expect(checkUpdateAvailable('/cache.json', deps)).toBe(false);
  });

  it('returns false for JSON array', () => {
    const deps = {
      readFileSync: () => '[true]',
    };

    expect(checkUpdateAvailable('/cache.json', deps)).toBe(false);
  });

  it('returns false when update_available is not a boolean', () => {
    const deps = {
      readFileSync: () => JSON.stringify({ update_available: 'yes' }),
    };

    expect(checkUpdateAvailable('/cache.json', deps)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildStatusline
// ---------------------------------------------------------------------------

describe('buildStatusline', () => {
  it('shows only Clancy label when no context available', () => {
    const result = buildStatusline(false, undefined);

    expect(result).toContain('Clancy');
    expect(result).not.toContain('%');
  });

  it('shows context bar when remaining is available', () => {
    const result = buildStatusline(false, 80);

    expect(result).toContain('Clancy');
    expect(result).toContain('%');
  });

  it('shows update badge when available', () => {
    const result = buildStatusline(true, undefined);

    expect(result).toContain('/clancy:update');
    expect(result).toContain('\u2B06');
  });

  it('shows both update badge and context bar with separator', () => {
    const result = buildStatusline(true, 80);

    expect(result).toContain('/clancy:update');
    expect(result).toContain('%');
    expect(result).toContain('\u2502');
  });

  it('does not show update badge when not available', () => {
    const result = buildStatusline(false, 80);

    expect(result).not.toContain('/clancy:update');
  });

  it('shows blinking skull at remaining = 0', () => {
    const result = buildStatusline(false, 0);

    expect(result).toContain('\u{1F480}');
    expect(result).toContain('100%');
  });

  it('shows version when provided', () => {
    const result = buildStatusline(false, 80, '0.9.3');

    expect(stripAnsi(result)).toContain('v0.9.3');
  });

  it('omits version when undefined', () => {
    const result = buildStatusline(false, 80);

    expect(stripAnsi(result)).not.toContain('v');
  });
});

// ---------------------------------------------------------------------------
// readInstalledVersion
// ---------------------------------------------------------------------------

describe('readInstalledVersion', () => {
  it('reads version from local project VERSION file', () => {
    const deps = {
      readFileSync: (path: string) => {
        if (path.includes('/project/')) return '0.9.3\n';
        throw new Error('ENOENT');
      },
    };

    expect(readInstalledVersion('/project', '/home', deps)).toBe('0.9.3');
  });

  it('falls back to global home VERSION file', () => {
    const deps = {
      readFileSync: (path: string) => {
        if (path.includes('/home/')) return '0.9.2\n';
        throw new Error('ENOENT');
      },
    };

    expect(readInstalledVersion('/project', '/home', deps)).toBe('0.9.2');
  });

  it('returns undefined when neither file exists', () => {
    const deps = {
      readFileSync: () => {
        throw new Error('ENOENT');
      },
    };

    expect(readInstalledVersion('/project', '/home', deps)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveCachePath
// ---------------------------------------------------------------------------

describe('resolveCachePath', () => {
  it('uses CLAUDE_CONFIG_DIR when provided', () => {
    const result = resolveCachePath({
      env: '/custom/claude',
      homedir: () => '/home/user',
    });

    expect(result).toContain('/custom/claude');
    expect(result).toContain('clancy-update-check.json');
  });

  it('falls back to ~/.claude when env is undefined', () => {
    const result = resolveCachePath({
      env: undefined,
      homedir: () => '/home/user',
    });

    expect(result).toContain('/home/user/.claude');
    expect(result).toContain('clancy-update-check.json');
  });
});
