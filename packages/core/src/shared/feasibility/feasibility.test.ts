import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

import {
  buildFeasibilityPrompt,
  checkFeasibility,
  parseFeasibilityResponse,
} from './feasibility.js';

// ─── buildFeasibilityPrompt ───────────────────────────────────────────

describe('buildFeasibilityPrompt', () => {
  it('includes ticket key, title, and description', () => {
    const prompt = buildFeasibilityPrompt({
      key: 'PROJ-1',
      title: 'Add login button',
      description: 'Add a login button to the header.',
    });

    expect(prompt).toContain('[PROJ-1] Add login button');
    expect(prompt).toContain('Add a login button to the header.');
  });

  it('includes infeasibility criteria', () => {
    const prompt = buildFeasibilityPrompt({
      key: 'X-1',
      title: 'T',
      description: 'D',
    });

    expect(prompt).toContain('INFEASIBLE');
    expect(prompt).toContain('FEASIBLE');
    expect(prompt).toContain('external');
  });
});

// ─── parseFeasibilityResponse ─────────────────────────────────────────

describe('parseFeasibilityResponse', () => {
  it('returns feasible for FEASIBLE response', () => {
    expect(parseFeasibilityResponse('FEASIBLE')).toEqual({ feasible: true });
  });

  it('returns feasible with extra whitespace', () => {
    expect(parseFeasibilityResponse('  FEASIBLE  \n')).toEqual({
      feasible: true,
    });
  });

  it('returns infeasible with reason', () => {
    expect(
      parseFeasibilityResponse('INFEASIBLE: requires OneTrust admin access'),
    ).toEqual({
      feasible: false,
      reason: 'requires OneTrust admin access',
    });
  });

  it('returns infeasible without reason when none given', () => {
    expect(parseFeasibilityResponse('INFEASIBLE')).toEqual({
      feasible: false,
      reason: undefined,
    });
  });

  it('is case-insensitive', () => {
    expect(parseFeasibilityResponse('infeasible: reason')).toEqual({
      feasible: false,
      reason: 'reason',
    });
  });

  it('fails open on empty output', () => {
    expect(parseFeasibilityResponse('')).toEqual({ feasible: true });
  });

  it('fails open on malformed output', () => {
    expect(parseFeasibilityResponse('I think this is feasible')).toEqual({
      feasible: true,
    });
  });

  it('uses last line of multi-line output', () => {
    expect(
      parseFeasibilityResponse(
        'Some preamble\nINFEASIBLE: needs manual testing',
      ),
    ).toEqual({
      feasible: false,
      reason: 'needs manual testing',
    });
  });
});

// ─── checkFeasibility ─────────────────────────────────────────────────

describe('checkFeasibility', () => {
  it('returns feasible when invoke returns FEASIBLE', () => {
    const invoke = vi.fn().mockReturnValue({ stdout: 'FEASIBLE', ok: true });
    const ticket = { key: 'PROJ-1', title: 'Test', description: 'desc' };

    expect(checkFeasibility(invoke, ticket)).toEqual({ feasible: true });
    expect(invoke).toHaveBeenCalledWith(expect.any(String), undefined);
  });

  it('returns infeasible when invoke returns INFEASIBLE', () => {
    const invoke = vi.fn().mockReturnValue({
      stdout: 'INFEASIBLE: requires external API',
      ok: true,
    });
    const ticket = { key: 'PROJ-1', title: 'Test', description: 'desc' };

    expect(checkFeasibility(invoke, ticket)).toEqual({
      feasible: false,
      reason: 'requires external API',
    });
  });

  it('fails open when invoke reports failure', () => {
    const invoke = vi.fn().mockReturnValue({ stdout: '', ok: false });
    const ticket = { key: 'PROJ-1', title: 'Test', description: 'desc' };

    expect(checkFeasibility(invoke, ticket)).toEqual({ feasible: true });
  });

  it('passes model to invoke', () => {
    const invoke = vi.fn().mockReturnValue({ stdout: 'FEASIBLE', ok: true });
    const ticket = { key: 'PROJ-1', title: 'Test', description: 'desc' };

    checkFeasibility(invoke, ticket, 'sonnet');

    expect(invoke).toHaveBeenCalledWith(expect.any(String), 'sonnet');
  });
});

// ─── Property-based ───────────────────────────────────────────────────

describe('parseFeasibilityResponse property-based', () => {
  it('returns feasible for any string not starting with INFEASIBLE', () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 0, maxLength: 200 })
          .filter((s) => !/^\s*INFEASIBLE/i.test(s)),
        (stdout) => {
          const result = parseFeasibilityResponse(stdout);
          return result.feasible === true && result.reason === undefined;
        },
      ),
    );
  });

  it('returns infeasible for any string starting with INFEASIBLE', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (suffix) => {
        const result = parseFeasibilityResponse(`INFEASIBLE${suffix}`);
        return result.feasible === false;
      }),
    );
  });
});
