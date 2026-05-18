import type {
  MessagesClient,
  MessagesCreateParams,
  MessagesResponse,
} from './parallel.js';
import type { Mock } from 'vitest';

import { describe, expect, it, vi } from 'vitest';

import { ANTHROPIC_AESTHETIC_TAXONOMY } from '../write/init.js';
import { generateParallel, pickThreeDistinct } from './parallel.js';

type CreateMock = Mock<
  (params: MessagesCreateParams) => Promise<MessagesResponse>
>;

const envelope = (id: string, seed: string, body = 'Hello'): string =>
  `<variant id="${id}" seed="${seed}">
<html><div data-clancy-slot="root">${body}</div></html>
<rationale>${id} rationale.</rationale>
</variant>`;

const buildMultiResponseClient = (
  texts: readonly string[],
): { readonly client: MessagesClient; readonly createMock: CreateMock } => {
  const createMock: CreateMock = vi.fn();
  texts.forEach((text) =>
    createMock.mockResolvedValueOnce({ content: [{ type: 'text', text }] }),
  );
  return { client: { create: createMock }, createMock };
};

describe('pickThreeDistinct', () => {
  it('returns exactly three items from the taxonomy', () => {
    const seeds = pickThreeDistinct(ANTHROPIC_AESTHETIC_TAXONOMY, 'abc-123');
    expect(seeds).toHaveLength(3);
    seeds.forEach((seed) =>
      expect(ANTHROPIC_AESTHETIC_TAXONOMY).toContain(seed),
    );
  });

  it('returns three distinct items', () => {
    const seeds = pickThreeDistinct(ANTHROPIC_AESTHETIC_TAXONOMY, 'abc-123');
    expect(new Set(seeds).size).toBe(3);
  });

  it('is deterministic for the same hash input', () => {
    const a = pickThreeDistinct(ANTHROPIC_AESTHETIC_TAXONOMY, 'session-foo');
    const b = pickThreeDistinct(ANTHROPIC_AESTHETIC_TAXONOMY, 'session-foo');
    expect(a).toEqual(b);
  });

  it('produces 8 distinct triples across 8 distinct session ids (djb2 spread)', () => {
    const observed = new Set(
      ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map((id) =>
        pickThreeDistinct(ANTHROPIC_AESTHETIC_TAXONOMY, id).join('|'),
      ),
    );
    expect(observed.size).toBe(8);
  });

  it('throws when taxonomy has fewer than 3 items', () => {
    expect(() => pickThreeDistinct(['only-one'], 's')).toThrow(
      /need at least 3/,
    );
  });
});

describe('generateParallel (slice 11 — 3-parallel variant generation)', () => {
  it('returns three Variants by calling the SDK three times', async () => {
    const { client, createMock } = buildMultiResponseClient([
      envelope('v1', 'editorial/magazine'),
      envelope('v2', 'brutalist/raw'),
      envelope('v3', 'soft/pastel'),
    ]);

    const variants = await generateParallel(
      {
        sessionId: 'abc-123',
        designContext: '# DESIGN\n\nMinimal.',
        seeds: ['editorial/magazine', 'brutalist/raw', 'soft/pastel'],
      },
      client,
    );

    expect(createMock).toHaveBeenCalledTimes(3);
    expect(variants).toHaveLength(3);
    expect(variants[0].id).toBe('v1');
    expect(variants[1].id).toBe('v2');
    expect(variants[2].id).toBe('v3');
    expect(new Set(variants.map((v) => v.seed)).size).toBe(3);
  });

  it('passes distinct variantId + seed per call when seeds are explicit', async () => {
    const { client, createMock } = buildMultiResponseClient([
      envelope('v1', 'luxury/refined'),
      envelope('v2', 'industrial/utilitarian'),
      envelope('v3', 'organic/natural'),
    ]);

    await generateParallel(
      {
        sessionId: 's',
        designContext: '',
        seeds: ['luxury/refined', 'industrial/utilitarian', 'organic/natural'],
      },
      client,
    );

    const callSeeds = createMock.mock.calls
      .map((c) => /seed="([^"]+)"/.exec(c[0].messages[0]?.content ?? '')?.[1])
      .filter((s): s is string => s !== undefined);
    expect(callSeeds).toEqual([
      'luxury/refined',
      'industrial/utilitarian',
      'organic/natural',
    ]);

    const callIds = createMock.mock.calls
      .map(
        (c) =>
          /variant id="([^"]+)"/.exec(c[0].messages[0]?.content ?? '')?.[1],
      )
      .filter((s): s is string => s !== undefined);
    expect(new Set(callIds).size).toBe(3);
  });

  it('defaults seeds to pickThreeDistinct(TAXONOMY, sessionId) when caller omits them', async () => {
    const expectedSeeds = pickThreeDistinct(
      ANTHROPIC_AESTHETIC_TAXONOMY,
      'reproducible-session',
    );
    const { client, createMock } = buildMultiResponseClient([
      envelope('v1', expectedSeeds[0]),
      envelope('v2', expectedSeeds[1]),
      envelope('v3', expectedSeeds[2]),
    ]);

    const variants = await generateParallel(
      {
        sessionId: 'reproducible-session',
        designContext: '',
      },
      client,
    );

    expect(variants.map((v) => v.seed)).toEqual([...expectedSeeds]);
    expect(createMock).toHaveBeenCalledTimes(3);
  });

  it('throws when the model echoes back a mismatched variant id', async () => {
    // Claude responds to all three requests with id="v1" — would silently
    // collide without the assertVariantId guard.
    const { client } = buildMultiResponseClient([
      envelope('v1', 's1'),
      envelope('v1', 's2'),
      envelope('v1', 's3'),
    ]);

    await expect(
      generateParallel(
        {
          sessionId: 'sess',
          designContext: '',
          seeds: ['s1', 's2', 's3'],
        },
        client,
      ),
    ).rejects.toThrow(/variant id mismatch/);
  });

  it('threads priorVariant + comments + model into all three calls', async () => {
    const { client, createMock } = buildMultiResponseClient([
      envelope('v1', 's1'),
      envelope('v2', 's2'),
      envelope('v3', 's3'),
    ]);

    await generateParallel(
      {
        sessionId: 'sess',
        designContext: '',
        priorVariant: '<prev/>',
        comments: 'make it bolder',
        model: 'opus',
        seeds: ['s1', 's2', 's3'],
      },
      client,
    );

    const models = createMock.mock.calls.map((c) => c[0].model);
    expect(models).toEqual([
      'claude-opus-4-7',
      'claude-opus-4-7',
      'claude-opus-4-7',
    ]);
    createMock.mock.calls.forEach((c) => {
      expect(c[0].messages[0]?.content).toContain('<prev/>');
      expect(c[0].messages[0]?.content).toContain('make it bolder');
    });
  });

  it('shares the same cached system prompt across all three calls', async () => {
    const { client, createMock } = buildMultiResponseClient([
      envelope('v1', 's1'),
      envelope('v2', 's2'),
      envelope('v3', 's3'),
    ]);

    await generateParallel(
      {
        sessionId: 'sess',
        designContext: '# DESIGN\n\nShared cache.',
        seeds: ['s1', 's2', 's3'],
      },
      client,
    );

    const systems = createMock.mock.calls.map((c) => c[0].system);
    expect(systems[0]).toEqual(systems[1]);
    expect(systems[1]).toEqual(systems[2]);
    expect(systems[0]).toEqual([
      {
        type: 'text',
        text: expect.stringContaining('# DESIGN\n\nShared cache.'),
        cache_control: { type: 'ephemeral' },
      },
    ]);
  });
});
