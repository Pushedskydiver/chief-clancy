import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { resolveCommitType } from './commit-type.js';

describe('resolveCommitType', () => {
  // ── Default fallback ─────────────────────────────────────────────────

  it('returns feat when ticketType is undefined', () => {
    expect(resolveCommitType(undefined)).toBe('feat');
  });

  it('returns feat when ticketType is empty string', () => {
    expect(resolveCommitType('')).toBe('feat');
  });

  it('returns feat when ticketType is whitespace', () => {
    expect(resolveCommitType('   ')).toBe('feat');
  });

  it('returns feat for unrecognised type', () => {
    expect(resolveCommitType('Story')).toBe('feat');
  });

  it('returns feat for "feature"', () => {
    expect(resolveCommitType('feature')).toBe('feat');
  });

  // ── Fix mapping ──────────────────────────────────────────────────────

  it('returns fix for "Bug"', () => {
    expect(resolveCommitType('Bug')).toBe('fix');
  });

  it('returns fix for "bug" (lowercase)', () => {
    expect(resolveCommitType('bug')).toBe('fix');
  });

  it('returns fix for "Bugfix"', () => {
    expect(resolveCommitType('Bugfix')).toBe('fix');
  });

  it('returns fix for "Defect"', () => {
    expect(resolveCommitType('Defect')).toBe('fix');
  });

  it('returns fix for "Hotfix"', () => {
    expect(resolveCommitType('Hotfix')).toBe('fix');
  });

  it('returns fix for "Incident"', () => {
    expect(resolveCommitType('Incident')).toBe('fix');
  });

  // ── Chore mapping ────────────────────────────────────────────────────

  it('returns chore for "Task"', () => {
    expect(resolveCommitType('Task')).toBe('chore');
  });

  it('returns chore for "chore"', () => {
    expect(resolveCommitType('chore')).toBe('chore');
  });

  it('returns chore for "Maintenance"', () => {
    expect(resolveCommitType('Maintenance')).toBe('chore');
  });

  it('returns chore for "Spike"', () => {
    expect(resolveCommitType('Spike')).toBe('chore');
  });

  it('returns chore for "Tech Debt"', () => {
    expect(resolveCommitType('Tech Debt')).toBe('chore');
  });

  it('returns chore for "Infrastructure"', () => {
    expect(resolveCommitType('Infrastructure')).toBe('chore');
  });

  // ── Case insensitivity ───────────────────────────────────────────────

  it('is case-insensitive', () => {
    expect(resolveCommitType('BUG')).toBe('fix');
    expect(resolveCommitType('TASK')).toBe('chore');
  });

  // ── Substring matching ───────────────────────────────────────────────

  it('matches bug within compound types', () => {
    expect(resolveCommitType('Production Bug')).toBe('fix');
  });

  it('matches task within compound types', () => {
    expect(resolveCommitType('Development Task')).toBe('chore');
  });

  // ── False-positive prevention ──────────────────────────────────────

  it('does not match "debugging" as fix', () => {
    expect(resolveCommitType('debugging')).toBe('feat');
  });

  it('does not match "tasking" as chore', () => {
    expect(resolveCommitType('tasking')).toBe('feat');
  });

  // ── Property-based ────────────────────────────────────────────────

  it('always returns feat, fix, or chore for any string', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const result = resolveCommitType(s);
        expect(['feat', 'fix', 'chore']).toContain(result);
      }),
    );
  });

  it('always returns feat for undefined', () => {
    expect(resolveCommitType(undefined)).toBe('feat');
  });
});
