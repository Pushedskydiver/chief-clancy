import type { Variant } from '../generate/types.js';

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { approveVariant, readApprovalMarker } from './approve.js';

const variant: Variant = {
  id: 'B1',
  seed: 'brutally minimal',
  html: '<button>Submit</button>',
  rationale: 'Reduced visual noise per comment feedback.',
};

const SHA = createHash('sha256').update(variant.html).digest('hex');

describe('approval marker persistence', () => {
  let sessionDir: string;

  beforeEach(async () => {
    sessionDir = await mkdtemp(join(tmpdir(), 'clancy-design-approve-'));
  });

  afterEach(async () => {
    await rm(sessionDir, { recursive: true, force: true });
  });

  it('writes approved/{slot} carrying variantId, roundId, sha, and ts', async () => {
    await approveVariant(sessionDir, 'h1.header', {
      variant,
      roundId: 'r2',
      now: new Date('2026-05-04T14:23:11.000Z'),
    });

    // The path and the field set are both the contract slices 21/22 read by,
    // so pin the file directly rather than round-tripping through this module.
    // `toEqual` is exact on purpose: the parent-shape `sessionId` and
    // `approverPid` are dropped here, and a leftover would pass `toMatchObject`.
    const raw = await readFile(
      join(sessionDir, 'approved', 'h1.header'),
      'utf8',
    );

    expect(JSON.parse(raw)).toEqual({
      variantId: 'B1',
      roundId: 'r2',
      sha: SHA,
      ts: '2026-05-04T14:23:11.000Z',
    });
  });

  it('mints ts from the real clock when now is omitted', async () => {
    // This module constructs its own record, so unlike every other storage
    // module in the rework it owns the clock (rework plan §Cross-cutting).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-24T09:00:00.000Z'));

    try {
      await approveVariant(sessionDir, 'h1.header', { variant, roundId: 'r1' });
    } finally {
      vi.useRealTimers();
    }

    const raw = await readFile(
      join(sessionDir, 'approved', 'h1.header'),
      'utf8',
    );

    expect(JSON.parse(raw)).toMatchObject({ ts: '2026-07-24T09:00:00.000Z' });
  });

  it('rejects a slot that is not a single entry directly inside approved/', async () => {
    // The marker filename carries no extension, so — unlike
    // `storage/elements.ts`, where the appended `.json` turns `..` into the
    // ordinary filename `...json` — a bare `..` here resolves to the session
    // directory itself, and `''` / `'.'` resolve to `approved/`. Nested slots
    // are rejected too: slice 21 walks `approved/` (spec §3.1 row 21), and a
    // marker one level down is invisible to that walk rather than merely
    // unusual.
    const rejected = ['..', '../../evil', '', '.', 'sub/slot', '/etc/passwd'];

    await Promise.all(
      rejected.flatMap((slot) => [
        expect(
          approveVariant(sessionDir, slot, { variant, roundId: 'r1' }),
        ).rejects.toThrow(/does not resolve to a single entry/),
        expect(readApprovalMarker(sessionDir, slot)).rejects.toThrow(
          /does not resolve to a single entry/,
        ),
      ]),
    );
  });

  it('reads the marker back for an accepted slot', async () => {
    await approveVariant(sessionDir, 'h1.header', {
      variant,
      roundId: 'r2',
      now: new Date('2026-05-04T14:23:11.000Z'),
    });

    expect(await readApprovalMarker(sessionDir, 'h1.header')).toEqual({
      variantId: 'B1',
      roundId: 'r2',
      sha: SHA,
      ts: '2026-05-04T14:23:11.000Z',
    });
  });

  it('returns null for a slot that has not been accepted', async () => {
    // Absence is the normal state, not an error: every slot is unaccepted
    // until a variant is committed for it, and §2.6 un-accept returns it here.
    expect(await readApprovalMarker(sessionDir, 'h1.header')).toBeNull();
  });

  it('throws on a marker left in the superseded per-variant shape', async () => {
    // Not hypothetical: the pre-rework module wrote this shape, and a session
    // directory created before A5 can still hold one — under the old filename,
    // but nothing stops a slot key from colliding with a variant id. Reads are
    // strict, so it surfaces rather than reading back as a marker with no
    // round, which slice 21 would then write to source against.
    await mkdir(join(sessionDir, 'approved'), { recursive: true });
    await writeFile(
      join(sessionDir, 'approved', 'h1.header'),
      JSON.stringify({
        variantId: 'B1',
        sessionId: 'sess_abc123',
        approvedAt: '2026-05-04T14:23:11.000Z',
        sha256: SHA,
        approverPid: 12345,
      }) + '\n',
      'utf8',
    );

    await expect(readApprovalMarker(sessionDir, 'h1.header')).rejects.toThrow();
  });

  it('rethrows a non-ENOENT read failure instead of reporting an unaccepted slot', async () => {
    // Make the marker path a directory so readFile rejects with EISDIR — a
    // failure that must propagate, not be swallowed as "not accepted yet",
    // which would silently un-accept a committed slot.
    await mkdir(join(sessionDir, 'approved', 'h1.header'), { recursive: true });

    await expect(
      readApprovalMarker(sessionDir, 'h1.header'),
    ).rejects.toMatchObject({ code: 'EISDIR' });
  });

  it('replaces the marker when a later round accepts a different variant for the slot', async () => {
    // Deliberately the opposite of `storage/variants.ts`, whose exclusive
    // write refuses a second write under a live id. A variant body is
    // immutable once generated; an accept marker is per-slot and holds
    // whichever variant is accepted *at a time* (§2.8), so re-accepting after
    // a new round overwrites. `toEqual` is exact so a merge — rather than a
    // replace — would fail here.
    await approveVariant(sessionDir, 'h1.header', {
      variant,
      roundId: 'r1',
      now: new Date('2026-05-04T14:23:11.000Z'),
    });

    const laterVariant: Variant = {
      ...variant,
      id: 'C3',
      html: '<button>Send</button>',
    };

    await approveVariant(sessionDir, 'h1.header', {
      variant: laterVariant,
      roundId: 'r2',
      now: new Date('2026-05-04T15:00:00.000Z'),
    });

    const raw = await readFile(
      join(sessionDir, 'approved', 'h1.header'),
      'utf8',
    );

    expect(JSON.parse(raw)).toEqual({
      variantId: 'C3',
      roundId: 'r2',
      sha: createHash('sha256').update(laterVariant.html).digest('hex'),
      ts: '2026-05-04T15:00:00.000Z',
    });
  });

  it('accepts a slot whose leading dots do not escape the approved dir', async () => {
    // Control for the guard above: `..foo` starts with `..` but is contained,
    // so a prefix test would over-reject it. Slots are derived from a stable
    // selector key, not minted, so the guard has to discriminate rather than
    // ban the character class.
    await approveVariant(sessionDir, '..foo', { variant, roundId: 'r1' });

    expect(
      JSON.parse(await readFile(join(sessionDir, 'approved', '..foo'), 'utf8')),
    ).toMatchObject({ variantId: 'B1' });
  });
});
