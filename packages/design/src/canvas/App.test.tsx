// @vitest-environment jsdom
import type { Variant } from '../generate/types.js';
import type { BoundingBox } from '../schemas/element-picked.js';

import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from './App.js';

afterEach(cleanup);

const ELEMENT_PICKED_TYPE = 'clancy:design:element-picked';

const makeAnchor = (
  boundingBox: BoundingBox = { top: 0, left: 0, width: 0, height: 0 },
) => ({
  selector: '[data-clancy-slot="abc"]',
  tag: 'button',
  textSnippet: 'click me',
  boundingBox,
});

const getIframeByTitle = (title: string): HTMLIFrameElement =>
  screen.getByTitle<HTMLIFrameElement>(title);

const dispatchPickedMessage = (
  source: Window | null,
  data: {
    readonly type?: string;
    readonly variantId?: string;
    readonly anchor?: ReturnType<typeof makeAnchor>;
  } = {},
): void => {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: data.type ?? ELEMENT_PICKED_TYPE,
          variantId: data.variantId ?? 'v1',
          anchor: data.anchor ?? makeAnchor(),
        },
        source,
      }),
    );
  });
};

describe('App', () => {
  it('renders a chat panel region', () => {
    render(<App />);

    const chatPanel = screen.queryByRole('region', { name: /chat panel/i });

    expect(chatPanel).not.toBeNull();
  });

  it('renders a variant grid region', () => {
    render(<App />);

    const variantGrid = screen.queryByRole('region', { name: /variant grid/i });

    expect(variantGrid).not.toBeNull();
  });

  it('renders an iframe inside the variant grid for each variant with src pointing at the variant route', () => {
    const variants: readonly Variant[] = [
      {
        id: 'v1',
        seed: 'editorial/magazine',
        html: '<p>hi</p>',
        rationale: 'test',
      },
    ];

    render(<App variants={variants} />);

    const variantGrid = screen.getByRole('region', { name: /variant grid/i });
    const iframe = within(variantGrid).getByTitle('editorial/magazine');

    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe.getAttribute('src')).toBe('/variants/v1');
  });

  it('renders one iframe per variant in input order with title=seed', () => {
    const variants: readonly Variant[] = [
      { id: 'v1', seed: 'brutally minimal', html: '<p>a</p>', rationale: 'r1' },
      {
        id: 'v2',
        seed: 'editorial/magazine',
        html: '<p>b</p>',
        rationale: 'r2',
      },
      { id: 'v3', seed: 'brutalist/raw', html: '<p>c</p>', rationale: 'r3' },
    ];

    render(<App variants={variants} />);

    const variantGrid = screen.getByRole('region', { name: /variant grid/i });
    const iframes = within(variantGrid).getAllByTitle(
      /^(brutally minimal|editorial\/magazine|brutalist\/raw)$/,
    );

    expect(iframes.map((iframe) => iframe.getAttribute('title'))).toEqual([
      'brutally minimal',
      'editorial/magazine',
      'brutalist/raw',
    ]);
    expect(iframes.map((iframe) => iframe.getAttribute('src'))).toEqual([
      '/variants/v1',
      '/variants/v2',
      '/variants/v3',
    ]);
  });

  it('sandboxes variant iframes with allow-scripts only — LLM-generated HTML must not navigate top, submit forms, or share the parent origin', () => {
    const variants: readonly Variant[] = [
      {
        id: 'v1',
        seed: 'editorial/magazine',
        html: '<p>x</p>',
        rationale: 'r',
      },
    ];

    render(<App variants={variants} />);

    const iframe = screen.getByTitle('editorial/magazine');

    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
  });

  it('renders a comment input modal when a valid element-picked message arrives from a registered variant iframe', () => {
    const variants: readonly Variant[] = [
      {
        id: 'v1',
        seed: 'editorial/magazine',
        html: '<p>x</p>',
        rationale: 'r',
      },
    ];

    render(<App variants={variants} />);

    const iframe = getIframeByTitle('editorial/magazine');

    dispatchPickedMessage(iframe.contentWindow, {
      anchor: makeAnchor({ top: 100, left: 50, width: 80, height: 30 }),
    });

    const modal = screen.queryByRole('dialog', { name: /comment/i });

    expect(modal).not.toBeNull();
  });

  it('ignores element-picked messages when event.source is not a registered variant iframe (sender-identity check)', () => {
    const variants: readonly Variant[] = [
      {
        id: 'v1',
        seed: 'editorial/magazine',
        html: '<p>x</p>',
        rationale: 'r',
      },
    ];

    render(<App variants={variants} />);

    // Arbitrary window object (e.g. a malicious iframe injected outside the
    // canvas SPA's variant grid) — must not pass the contentWindow identity
    // check.
    dispatchPickedMessage(window, {});

    expect(screen.queryByRole('dialog', { name: /comment/i })).toBeNull();
  });

  it('ignores element-picked messages when event.data.variantId disagrees with the sender-resolved variantId (anti-spoof cross-check)', () => {
    const variants: readonly Variant[] = [
      { id: 'v1', seed: 'brutally minimal', html: '<p>a</p>', rationale: 'r1' },
      {
        id: 'v2',
        seed: 'editorial/magazine',
        html: '<p>b</p>',
        rationale: 'r2',
      },
    ];

    render(<App variants={variants} />);

    const iframeV1 = getIframeByTitle('brutally minimal');

    // iframeV1 (sender) claims to be variantId 'v2'. Compromised variants
    // could lie about their own id; the contentWindow handle cannot be forged.
    dispatchPickedMessage(iframeV1.contentWindow, { variantId: 'v2' });

    expect(screen.queryByRole('dialog', { name: /comment/i })).toBeNull();
  });

  it('ignores messages whose type is not clancy:design:element-picked', () => {
    const variants: readonly Variant[] = [
      {
        id: 'v1',
        seed: 'editorial/magazine',
        html: '<p>x</p>',
        rationale: 'r',
      },
    ];

    render(<App variants={variants} />);

    const iframe = getIframeByTitle('editorial/magazine');

    dispatchPickedMessage(iframe.contentWindow, { type: 'unrelated:event' });

    expect(screen.queryByRole('dialog', { name: /comment/i })).toBeNull();
  });
});
