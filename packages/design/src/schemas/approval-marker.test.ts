import type { ApprovalMarker } from './approval-marker.js';

import { describe, expect, it } from 'vitest';
import { z } from 'zod/mini';

import { approvalMarkerSchema } from './approval-marker.js';

const base: ApprovalMarker = {
  variantId: 'B1',
  roundId: 'r2',
  sha: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  ts: '2026-05-11T12:00:00.000Z',
};

describe('approvalMarkerSchema', () => {
  it('parses the §2.8-shaped marker', () => {
    expect(z.parse(approvalMarkerSchema, base)).toEqual(base);
  });

  it('rejects a marker in the superseded per-variant shape', () => {
    // The parent spec's marker was `{variantId, sessionId, approvedAt,
    // sha256, approverPid}` at `{variantId}.approved`. There is no migration
    // (no back-compat shims), so a marker left by the pre-rework module has
    // to fail the parse rather than read back as a marker missing its round.
    const parentShape = {
      variantId: 'B1',
      sessionId: 'sess_abc123',
      approvedAt: '2026-05-11T12:00:00.000Z',
      sha256: base.sha,
      approverPid: 12345,
    };

    expect(z.safeParse(approvalMarkerSchema, parentShape).success).toBe(false);
  });

  it('rejects a marker missing roundId', () => {
    const withoutRoundId = {
      variantId: base.variantId,
      sha: base.sha,
      ts: base.ts,
    };

    expect(z.safeParse(approvalMarkerSchema, withoutRoundId).success).toBe(
      false,
    );

    // Control: the identical shape with roundId restored parses, proving the
    // rejection is driven by that field rather than an unrelated one.
    expect(z.safeParse(approvalMarkerSchema, base).success).toBe(true);
  });

  it('preserves unknown keys so a later slice can extend the shape', () => {
    const withExtra = { ...base, futureField: 'kept' };

    expect(z.parse(approvalMarkerSchema, withExtra)).toEqual(withExtra);
  });
});
