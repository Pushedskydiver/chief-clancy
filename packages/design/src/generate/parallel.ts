/**
 * 3-parallel variant generation — Phase F slice 11.
 *
 * Calls `generate()` three times in parallel via `Promise.all`, sharing the
 * same `designContext` so the SDK can hit prompt-cache ephemeral for the
 * second and third call. Each call gets a distinct seed (default
 * `pickThreeDistinct(ANTHROPIC_AESTHETIC_TAXONOMY, sessionId)`) and a
 * fixed `v1/v2/v3` variant id.
 *
 * **Seed strategy.** First-iteration default uses deterministic
 * `pickThreeDistinct` — same `sessionId` reproduces the same seed triple
 * across runs. Callers can override via `seeds: [s1, s2, s3]` to support
 * (a) refinement mode (spec L255: `Array(3).fill(chosenAesthetic)` to vary
 * within a chosen direction), and (b) user override ("show me a synthwave
 * variant" — spec L238). Slice 11 v0.1 does NOT branch on
 * first-vs-subsequent iteration internally; the caller selects the seed
 * strategy.
 *
 * **Cache sharing.** All three calls share the same system prompt
 * (built from `designContext` via slice 10's `generate()`); the
 * `cache_control: { type: 'ephemeral' }` block means the second and third
 * call read the cache instead of re-writing per spec §3 cost model. Worst
 * case all three pay cache-write surcharge (Anthropic doesn't document
 * parallel-write dedup); best case the first writes and the others read.
 * Cache reuse depends on `input.designContext` being byte-identical across
 * the three calls; `generateParallel` enforces this by sharing one `input`
 * object via `Promise.all`. External callers must not mutate
 * `designContext` mid-slice.
 *
 * **Variant-id integrity.** Slice 10's `parseVariant` extracts `id` from
 * the model's emitted `<variant id="…">` without verifying it equals the
 * requested `variantId`. In the single-call case, a mismatch is a curiosity;
 * in the parallel case, two calls echoing the same id would silently
 * collide when downstream code (canvas slice 13) keys on `variant.id`.
 * `generateParallel` adds a per-result assertion that the model returned
 * the requested id; mismatch throws and the call rejects (callers see the
 * Promise.all failure path).
 *
 * **Rate limits.** Spec §3 open risks L334 calls out the 3-parallel-on-free-tier
 * concern. Slice 11 v0.1 lets `Promise.all` surface any rejection from the
 * underlying SDK; the canvas slice 13 owns the rate-limit fall-back-to-sequential
 * retry path because that's where the user-visible status UI lives.
 */
import type { GenerateInput, Variant } from './single.js';

import { ANTHROPIC_AESTHETIC_TAXONOMY } from '../write/init.js';
import { generate } from './single.js';

export type {
  MessagesClient,
  MessagesCreateParams,
  MessagesResponse,
} from './single.js';

export type GenerateParallelInput = Omit<
  GenerateInput,
  'variantId' | 'seed'
> & {
  readonly seeds?: readonly [string, string, string];
};

export type VariantTriple = readonly [Variant, Variant, Variant];

const TRIPLE_VARIANT_IDS = ['v1', 'v2', 'v3'] as const;
const TRIPLE_SIZE = 3;

const djb2 = (s: string): number =>
  [...s].reduce((h, ch) => (h * 33 + ch.charCodeAt(0)) | 0, 5381) >>> 0;

export function pickThreeDistinct<T>(
  taxonomy: readonly T[],
  hash: string,
): readonly [T, T, T] {
  if (taxonomy.length < TRIPLE_SIZE) {
    throw new Error(
      `pickThreeDistinct: need at least ${TRIPLE_SIZE} items in taxonomy (got ${taxonomy.length})`,
    );
  }
  const len = taxonomy.length;
  const start = djb2(hash) % len;
  const stride = Math.max(1, Math.floor(len / TRIPLE_SIZE));
  return [
    taxonomy[start],
    taxonomy[(start + stride) % len],
    taxonomy[(start + 2 * stride) % len],
  ] as const;
}

const resolveSeeds = (
  input: GenerateParallelInput,
): readonly [string, string, string] =>
  input.seeds ??
  pickThreeDistinct(ANTHROPIC_AESTHETIC_TAXONOMY, input.sessionId);

const assertVariantId = (variant: Variant, requestedId: string): Variant => {
  if (variant.id !== requestedId) {
    throw new Error(
      `generateParallel: variant id mismatch — requested "${requestedId}", got "${variant.id}"`,
    );
  }
  return variant;
};

export async function generateParallel(
  input: GenerateParallelInput,
  client: Parameters<typeof generate>[1],
): Promise<VariantTriple> {
  const seeds = resolveSeeds(input);
  const variants = await Promise.all(
    seeds.map(async (seed, idx) => {
      const requestedId = TRIPLE_VARIANT_IDS[idx];
      const variant = await generate(
        { ...input, variantId: requestedId, seed },
        client,
      );
      return assertVariantId(variant, requestedId);
    }),
  );
  return [variants[0], variants[1], variants[2]] as const;
}
