import type {
  MessagesClient,
  MessagesCreateParams,
  MessagesResponse,
} from './single.js';
import type { Mock } from 'vitest';

import { describe, expect, it, vi } from 'vitest';

import { generate, VariantParseError } from './single.js';

const VALID_RESPONSE = `<variant id="v1" seed="editorial/magazine">
<html><div data-clancy-slot="root">Hello</div></html>
<rationale>Editorial layout uses generous whitespace.</rationale>
</variant>`;

type CreateMock = Mock<
  (params: MessagesCreateParams) => Promise<MessagesResponse>
>;

const buildClient = (
  text: string,
): { readonly client: MessagesClient; readonly createMock: CreateMock } => {
  const createMock: CreateMock = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text }],
  });
  return { client: { create: createMock }, createMock };
};

const firstCallArgs = (mock: CreateMock): MessagesCreateParams | undefined =>
  mock.mock.calls[0]?.[0];

describe('generate (slice 10 — single-call variant)', () => {
  it('parses a well-formed XML envelope into a Variant', async () => {
    const { client } = buildClient(VALID_RESPONSE);

    const result = await generate(
      {
        variantId: 'v1',
        seed: 'editorial/magazine',
        sessionId: 'abc-123',
        designContext: '# DESIGN\n\nMinimal design system.',
      },
      client,
    );

    expect(result).toEqual({
      id: 'v1',
      seed: 'editorial/magazine',
      html: '<div data-clancy-slot="root">Hello</div>',
      rationale: 'Editorial layout uses generous whitespace.',
    });
  });

  it('calls SDK with Sonnet model + ephemeral-cached system + variantId/seed in user prompt', async () => {
    const { client, createMock } = buildClient(VALID_RESPONSE);

    await generate(
      {
        variantId: 'v7',
        seed: 'brutalist/raw',
        sessionId: 'sess-99',
        designContext: '# DESIGN\n\nFoo.',
      },
      client,
    );

    expect(createMock).toHaveBeenCalledTimes(1);
    const args = firstCallArgs(createMock);
    expect(args?.model).toBe('claude-sonnet-4-6');
    expect(args?.max_tokens).toBe(8192);
    expect(args?.system).toEqual([
      {
        type: 'text',
        text: expect.stringContaining('# DESIGN\n\nFoo.'),
        cache_control: { type: 'ephemeral' },
      },
    ]);
    expect(args?.messages).toEqual([
      {
        role: 'user',
        content: expect.stringContaining('variant id="v7"'),
      },
    ]);
    expect(args?.messages[0]?.content).toContain('seed="brutalist/raw"');
    expect(args?.messages[0]?.content).toContain('Session: sess-99');
  });

  it('uses Opus model id when model: "opus" is passed', async () => {
    const { client, createMock } = buildClient(VALID_RESPONSE);

    await generate(
      {
        variantId: 'v1',
        seed: 'luxury/refined',
        sessionId: 's',
        designContext: '',
        model: 'opus',
      },
      client,
    );

    expect(firstCallArgs(createMock)?.model).toBe('claude-opus-4-7');
  });

  it('includes prior variant + comments in the user prompt on subsequent iterations', async () => {
    const { client, createMock } = buildClient(VALID_RESPONSE);

    await generate(
      {
        variantId: 'v2',
        seed: 'editorial/magazine',
        sessionId: 's',
        designContext: '',
        priorVariant: '<previous html>...</previous html>',
        comments: 'Make the heading bolder.',
      },
      client,
    );

    const content = firstCallArgs(createMock)?.messages[0]?.content;
    expect(content).toContain('Prior variant:');
    expect(content).toContain('<previous html>...</previous html>');
    expect(content).toContain('User comments to address:');
    expect(content).toContain('Make the heading bolder.');
  });

  it('throws VariantParseError on malformed XML envelope', async () => {
    const { client } = buildClient(
      '<not-a-variant>no envelope here</not-a-variant>',
    );

    const call = generate(
      {
        variantId: 'v1',
        seed: 's',
        sessionId: 's',
        designContext: '',
      },
      client,
    );

    await expect(call).rejects.toBeInstanceOf(VariantParseError);
    await expect(call).rejects.toThrow(/Variant parse failed/);
  });

  it('throws VariantParseError when response has no text content block', async () => {
    const createMock: CreateMock = vi.fn().mockResolvedValue({
      content: [{ type: 'tool_use' }],
    });
    const client: MessagesClient = { create: createMock };

    await expect(
      generate(
        {
          variantId: 'v1',
          seed: 's',
          sessionId: 's',
          designContext: '',
        },
        client,
      ),
    ).rejects.toThrow(/no text block/);
  });

  it('parses envelope with swapped attribute order (seed before id)', async () => {
    const swapped = `<variant seed="brutalist/raw" id="v3">
<html><h1>Swapped</h1></html>
<rationale>Attribute order should not matter.</rationale>
</variant>`;
    const { client } = buildClient(swapped);

    const result = await generate(
      {
        variantId: 'v3',
        seed: 'brutalist/raw',
        sessionId: 's',
        designContext: '',
      },
      client,
    );

    expect(result.id).toBe('v3');
    expect(result.seed).toBe('brutalist/raw');
  });

  it('system prompt mandates data-clancy-slot on every interactive and structural element + preservation across iterations (slice 19 — spec §Phase 4 — "Anchor stability — data-clancy-slot injection")', async () => {
    const { client, createMock } = buildClient(VALID_RESPONSE);

    await generate(
      {
        variantId: 'v1',
        seed: 'editorial/magazine',
        sessionId: 's',
        designContext: '',
      },
      client,
    );

    const system = firstCallArgs(createMock)?.system;
    const systemText = Array.isArray(system) ? system[0]?.text : undefined;
    expect(systemText).toContain(
      'Every interactive element and major structural element',
    );
    expect(systemText).toContain('data-clancy-slot');
    expect(systemText).toContain(
      'PRESERVE existing data-clancy-slot values on retained elements',
    );
    expect(systemText).toContain(
      'Generate fresh slot IDs only for newly-introduced elements',
    );
  });

  it('system prompt encodes the Q8 variant-CSS strategy: scoped <style> + CSS variables, no Tailwind / external stylesheets (slice 19 Q8 fold)', async () => {
    const { client, createMock } = buildClient(VALID_RESPONSE);

    await generate(
      {
        variantId: 'v1',
        seed: 'editorial/magazine',
        sessionId: 's',
        designContext: '',
      },
      client,
    );

    const system = firstCallArgs(createMock)?.system;
    const systemText = Array.isArray(system) ? system[0]?.text : undefined;
    expect(systemText).toContain('scoped <style> block');
    expect(systemText).toContain('CSS variables');
    expect(systemText).toContain('Do NOT use Tailwind utility classes');
    expect(systemText).toContain('Do NOT link external stylesheets');
    expect(systemText).toContain('sandboxed iframe');
  });

  it('picks the text block when response interleaves non-text blocks', async () => {
    const createMock: CreateMock = vi.fn().mockResolvedValue({
      content: [{ type: 'thinking' }, { type: 'text', text: VALID_RESPONSE }],
    });
    const client: MessagesClient = { create: createMock };

    const result = await generate(
      {
        variantId: 'v1',
        seed: 'editorial/magazine',
        sessionId: 's',
        designContext: '',
      },
      client,
    );

    expect(result.id).toBe('v1');
    expect(result.html).toBe('<div data-clancy-slot="root">Hello</div>');
  });
});
