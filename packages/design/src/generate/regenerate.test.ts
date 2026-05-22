import type { Comment } from '../schemas/comment.js';
import type {
  MessagesClient,
  MessagesCreateParams,
  MessagesResponse,
} from './single.js';
import type { Mock } from 'vitest';

import { describe, expect, it, vi } from 'vitest';

import { regenerate } from './regenerate.js';

const VALID_RESPONSE = `<variant id="v2" seed="editorial/magazine">
<html><div data-clancy-slot="root">Iterated</div></html>
<rationale>Increased heading weight per comment.</rationale>
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

const buildComment = (overrides: Partial<Comment>): Comment => ({
  id: overrides.id ?? 'c-1',
  variantId: overrides.variantId ?? 'v2',
  anchor: overrides.anchor ?? {
    selector: "[data-clancy-slot='heading-1']",
    tag: 'H1',
    textSnippet: 'Welcome',
    boundingBox: { top: 0, left: 0, width: 100, height: 24 },
  },
  text: overrides.text ?? 'Make the heading bolder.',
  status: overrides.status ?? 'open',
  createdAt: overrides.createdAt ?? '2026-05-22T10:00:00.000Z',
  addressedAt: overrides.addressedAt,
  addressedByVariantId: overrides.addressedByVariantId,
});

const userContent = (mock: CreateMock): string => {
  const args = mock.mock.calls[0]?.[0];
  return args?.messages[0]?.content ?? '';
};

describe('regenerate (slice 19 — variant regeneration with comments context)', () => {
  it('threads only open comments matching the target variantId into the prompt', async () => {
    const { client, createMock } = buildClient(VALID_RESPONSE);

    const comments: readonly Comment[] = [
      buildComment({
        id: 'c-open-match',
        variantId: 'v2',
        status: 'open',
        text: 'OPEN-MATCH text',
      }),
      buildComment({
        id: 'c-addressed-match',
        variantId: 'v2',
        status: 'addressed',
        text: 'ADDRESSED-MATCH text',
      }),
      buildComment({
        id: 'c-stale-match',
        variantId: 'v2',
        status: 'stale',
        text: 'STALE-MATCH text',
      }),
      buildComment({
        id: 'c-open-other',
        variantId: 'v1',
        status: 'open',
        text: 'OPEN-OTHER text',
      }),
    ];

    await regenerate(
      {
        variantId: 'v2',
        seed: 'editorial/magazine',
        sessionId: 'sess-42',
        designContext: '# DESIGN\n\nCtx.',
        priorVariant: '<div data-clancy-slot="root">Welcome</div>',
        comments,
      },
      client,
    );

    const content = userContent(createMock);
    expect(content).toContain('OPEN-MATCH text');
    expect(content).not.toContain('ADDRESSED-MATCH text');
    expect(content).not.toContain('STALE-MATCH text');
    expect(content).not.toContain('OPEN-OTHER text');
  });

  it('omits the comments block from the prompt when no open comments match the target variantId', async () => {
    const { client, createMock } = buildClient(VALID_RESPONSE);

    const comments: readonly Comment[] = [
      buildComment({
        id: 'c-addressed',
        variantId: 'v2',
        status: 'addressed',
        text: 'already handled',
      }),
      buildComment({
        id: 'c-other-variant',
        variantId: 'v1',
        status: 'open',
        text: 'about v1',
      }),
    ];

    await regenerate(
      {
        variantId: 'v2',
        seed: 'editorial/magazine',
        sessionId: 's',
        designContext: '',
        priorVariant: '<div data-clancy-slot="root">Welcome</div>',
        comments,
      },
      client,
    );

    const content = userContent(createMock);
    expect(content).not.toContain('User comments to address:');
    expect(content).toContain('Prior variant:');
  });

  it('serialises surviving comments as newline-delimited JSON (JSONL per spec §Phase 4 — Iteration loop step 6)', async () => {
    const { client, createMock } = buildClient(VALID_RESPONSE);

    const comments: readonly Comment[] = [
      buildComment({ id: 'c-A', text: 'AAA text' }),
      buildComment({ id: 'c-B', text: 'BBB text' }),
    ];

    await regenerate(
      {
        variantId: 'v2',
        seed: 'editorial/magazine',
        sessionId: 's',
        designContext: '',
        priorVariant: '<div data-clancy-slot="root">Welcome</div>',
        comments,
      },
      client,
    );

    const content = userContent(createMock);
    const jsonLines = content
      .split('\n')
      .filter((line) => line.startsWith('{') && line.endsWith('}'));
    expect(jsonLines).toHaveLength(2);
    expect(JSON.parse(jsonLines[0]).id).toBe('c-A');
    expect(JSON.parse(jsonLines[1]).id).toBe('c-B');
  });
});
