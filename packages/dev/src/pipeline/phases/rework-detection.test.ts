import type { ReworkDetectionDeps } from './rework-detection.js';
import type { FetchedTicket } from '@chief-clancy/core/types/board.js';

import { describe, expect, it, vi } from 'vitest';

import { reworkDetection } from './rework-detection.js';
import { makeCtx } from './test-helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TICKET: FetchedTicket = {
  key: 'PROJ-42',
  title: 'Fix login bug',
  description: 'The login form crashes on submit',
  parentInfo: 'PROJ-100',
  blockers: 'None',
};

function makeDeps(
  overrides: Partial<ReworkDetectionDeps> = {},
): ReworkDetectionDeps {
  return {
    fetchRework: vi.fn(() => Promise.resolve(undefined)),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('reworkDetection', () => {
  it('returns isDetected: false when no rework found', async () => {
    const ctx = makeCtx();
    const deps = makeDeps();

    const result = await reworkDetection(ctx, deps);

    expect(result.isDetected).toBe(false);
    expect(result.ticketKey).toBeUndefined();
  });

  it('returns isDetected: true when rework found', async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      fetchRework: vi.fn(() =>
        Promise.resolve({
          ticket: TICKET,
          feedback: ['Fix the null check'],
          prNumber: 55,
          reviewers: ['reviewer-1'],
        }),
      ),
    });

    const result = await reworkDetection(ctx, deps);

    expect(result.isDetected).toBe(true);
    expect(result.ticketKey).toBe('PROJ-42');
  });

  it('sets rework fields on context via setRework', async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      fetchRework: vi.fn(() =>
        Promise.resolve({
          ticket: TICKET,
          feedback: ['Fix the null check'],
          prNumber: 55,
          discussionIds: ['d-1', 'd-2'],
          reviewers: ['reviewer-1'],
        }),
      ),
    });

    await reworkDetection(ctx, deps);

    expect(ctx.isRework).toBe(true);
    expect(ctx.prFeedback).toEqual(['Fix the null check']);
    expect(ctx.reworkPrNumber).toBe(55);
    expect(ctx.reworkDiscussionIds).toEqual(['d-1', 'd-2']);
    expect(ctx.reworkReviewers).toEqual(['reviewer-1']);
  });

  it('sets ticket on context via setTicket', async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      fetchRework: vi.fn(() =>
        Promise.resolve({
          ticket: TICKET,
          feedback: [],
          prNumber: 10,
          reviewers: [],
        }),
      ),
    });

    await reworkDetection(ctx, deps);

    expect(ctx.ticket).toBe(TICKET);
  });

  it('does not mutate context when no rework found', async () => {
    const ctx = makeCtx();
    const deps = makeDeps();

    await reworkDetection(ctx, deps);

    expect(ctx.isRework).toBeUndefined();
    expect(ctx.ticket).toBeUndefined();
    expect(ctx.prFeedback).toBeUndefined();
  });

  it('catches errors and returns isDetected: false', async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      fetchRework: vi.fn(() => Promise.reject(new Error('network error'))),
    });

    const result = await reworkDetection(ctx, deps);

    expect(result.isDetected).toBe(false);
    expect(ctx.isRework).toBeUndefined();
  });

  it('catches sync errors and returns isDetected: false', async () => {
    const ctx = makeCtx();
    const deps: ReworkDetectionDeps = {
      fetchRework: vi.fn(() => {
        throw new Error('sync boom');
      }),
    };

    const result = await reworkDetection(ctx, deps);

    expect(result.isDetected).toBe(false);
  });

  it('passes config to fetchRework', async () => {
    const ctx = makeCtx();
    const fetchRework = vi.fn(() => Promise.resolve(undefined));
    const deps = makeDeps({ fetchRework });

    await reworkDetection(ctx, deps);

    expect(fetchRework).toHaveBeenCalledWith(ctx.config);
  });
});
