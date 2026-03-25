import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { formatDuration } from './format.js';

describe('formatDuration', () => {
  it('returns 0s for 0ms', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('returns seconds only for < 60s', () => {
    expect(formatDuration(30_000)).toBe('30s');
  });

  it('returns exact minutes without remainder', () => {
    expect(formatDuration(60_000)).toBe('1m');
  });

  it('returns minutes and seconds with remainder', () => {
    expect(formatDuration(90_000)).toBe('1m 30s');
  });

  it('returns exact hours without remainder', () => {
    expect(formatDuration(3_600_000)).toBe('1h');
  });

  it('returns hours and minutes with remainder', () => {
    expect(formatDuration(5_400_000)).toBe('1h 30m');
  });

  it('returns multi-hour durations', () => {
    expect(formatDuration(7_200_000)).toBe('2h');
  });

  it('drops seconds for hour-scale durations', () => {
    expect(formatDuration(3_661_000)).toBe('1h 1m');
  });

  it('clamps negative input to 0s', () => {
    expect(formatDuration(-1000)).toBe('0s');
  });

  it('floors sub-second input to 0s', () => {
    expect(formatDuration(999)).toBe('0s');
  });

  it('never produces negative components', () => {
    fc.assert(
      fc.property(fc.nat({ max: 86_400_000 }), (ms) => {
        const result = formatDuration(ms);
        const numbers = result.match(/\d+/g)?.map(Number) ?? [];
        return numbers.every((n) => n >= 0);
      }),
    );
  });

  it('always produces a non-empty string', () => {
    fc.assert(
      fc.property(fc.nat({ max: 86_400_000 }), (ms) => {
        return formatDuration(ms).length > 0;
      }),
    );
  });

  it('uses only s/m/h unit suffixes', () => {
    fc.assert(
      fc.property(fc.nat({ max: 86_400_000 }), (ms) => {
        const result = formatDuration(ms);
        return /^(\d+[smh]\s?)+$/.test(result.trim());
      }),
    );
  });
});
