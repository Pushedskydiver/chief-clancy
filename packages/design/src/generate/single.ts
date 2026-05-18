/**
 * Single-call variant generation — Phase F slice 10.
 *
 * Calls the Anthropic SDK once and returns a parsed `Variant`. v0.1 is
 * non-streaming; the streaming variant lands in slice 13 (canvas SPA) where
 * fast first-render matters. Slice 11 (3-parallel) wraps this function in a
 * `Promise.all` over three seeds with shared cached context.
 *
 * **Client injection.** The SDK client is passed as a `MessagesClient`
 * argument rather than constructed inside the function — this keeps the
 * function deterministic, lets tests pass a mock that returns a canned
 * envelope, and defers real-key sourcing to slice 12 (server gate) per spec
 * §11. The structural interface intentionally mirrors the subset of
 * `Anthropic.Messages.create` we use; the real `new Anthropic({...}).messages`
 * satisfies it without an explicit cast. Slice 10 does not depend on
 * `@anthropic-ai/sdk` at runtime — the package install + `createClient`
 * factory belong to slice 12.
 *
 * **Output contract.** Claude is prompted to emit a single
 * `<variant id="…" seed="…">…<html>…</html><rationale>…</rationale></variant>`
 * envelope per spec §3 (output format). The parser extracts the four fields
 * via regex — v0.1 accepts loose interior whitespace but requires the four
 * tags to be present and balanced. Malformed output throws
 * `VariantParseError`; slice 13 (canvas) catches and retries with a
 * `Continue from <variant id="…">` continuation per spec §3 open risks.
 */
import type { GenerateInput, MessagesClient, Variant } from './types.js';

export type {
  GenerateInput,
  MessagesClient,
  MessagesCreateParams,
  MessagesResponse,
  Variant,
} from './types.js';

const MAX_OUTPUT_TOKENS = 4096;

const MODEL_IDS = {
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-7',
} as const;

const RE_ID = /<variant\s+id="([^"]+)"\s+seed="([^"]+)">/;
const RE_HTML = /<html>([\s\S]*?)<\/html>/;
const RE_RATIONALE = /<rationale>([\s\S]*?)<\/rationale>/;

export class VariantParseError extends Error {
  constructor(
    reason: string,
    public readonly raw: string,
  ) {
    super(`Variant parse failed: ${reason}`);
    this.name = 'VariantParseError';
  }
}

const buildSystemPrompt = (designContext: string): string =>
  [
    'You are a UI design assistant. Generate one HTML variant inspired by',
    'the design context provided. Wrap your output in the following XML:',
    '',
    '<variant id="{id}" seed="{seed}">',
    '<html>{generated HTML with data-clancy-slot attributes on major elements}</html>',
    '<rationale>{one short paragraph explaining the design decisions}</rationale>',
    '</variant>',
    '',
    'Preserve existing data-clancy-slot attributes when iterating on a prior variant.',
    '',
    '---',
    '',
    designContext,
  ].join('\n');

const buildUserPrompt = (input: GenerateInput): string => {
  const head: readonly string[] = [
    `Generate variant id="${input.variantId}" with seed="${input.seed}".`,
    `Session: ${input.sessionId}.`,
  ];
  const prior: readonly string[] =
    input.priorVariant !== undefined
      ? ['', 'Prior variant:', input.priorVariant]
      : [];
  const comments: readonly string[] =
    input.comments !== undefined
      ? ['', 'User comments to address:', input.comments]
      : [];
  return [...head, ...prior, ...comments].join('\n');
};

const extractText = (
  response: Awaited<ReturnType<MessagesClient['create']>>,
): string => {
  const block = response.content[0];
  if (
    block === undefined ||
    block.type !== 'text' ||
    block.text === undefined
  ) {
    throw new VariantParseError(
      'response.content[0] is not a text block',
      JSON.stringify(response),
    );
  }
  return block.text;
};

const parseVariant = (raw: string): Variant => {
  const idMatch = RE_ID.exec(raw);
  const htmlMatch = RE_HTML.exec(raw);
  const rationaleMatch = RE_RATIONALE.exec(raw);
  if (idMatch === null || htmlMatch === null || rationaleMatch === null) {
    throw new VariantParseError(
      'missing one of <variant>/<html>/<rationale>',
      raw,
    );
  }
  return {
    id: idMatch[1],
    seed: idMatch[2],
    html: htmlMatch[1].trim(),
    rationale: rationaleMatch[1].trim(),
  };
};

export async function generate(
  input: GenerateInput,
  client: MessagesClient,
): Promise<Variant> {
  const model = MODEL_IDS[input.model ?? 'sonnet'];
  const response = await client.create({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      {
        type: 'text',
        text: buildSystemPrompt(input.designContext),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
  });
  return parseVariant(extractText(response));
}
