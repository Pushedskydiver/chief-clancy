// @vitest-environment jsdom
import type { Variant } from '../generate/types.js';

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from './App.js';

afterEach(cleanup);

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
      { id: 'v1', seed: 'minimal', html: '<p>hi</p>', rationale: 'test' },
    ];

    render(<App variants={variants} />);

    const variantGrid = screen.getByRole('region', { name: /variant grid/i });
    const iframe = within(variantGrid).getByTitle('minimal');

    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe.getAttribute('src')).toBe('/variants/v1');
  });

  it('renders one iframe per variant in input order with title=seed per spec §13(e)', () => {
    const variants: readonly Variant[] = [
      { id: 'v1', seed: 'minimal', html: '<p>a</p>', rationale: 'r1' },
      { id: 'v2', seed: 'editorial', html: '<p>b</p>', rationale: 'r2' },
      { id: 'v3', seed: 'kinetic', html: '<p>c</p>', rationale: 'r3' },
    ];

    render(<App variants={variants} />);

    const variantGrid = screen.getByRole('region', { name: /variant grid/i });
    const iframes = within(variantGrid).getAllByTitle(
      /^(minimal|editorial|kinetic)$/,
    );

    expect(iframes.map((iframe) => iframe.getAttribute('title'))).toEqual([
      'minimal',
      'editorial',
      'kinetic',
    ]);
    expect(iframes.map((iframe) => iframe.getAttribute('src'))).toEqual([
      '/variants/v1',
      '/variants/v2',
      '/variants/v3',
    ]);
  });

  it('sandboxes variant iframes with allow-scripts only — LLM-generated HTML must not navigate top, submit forms, or share the parent origin', () => {
    const variants: readonly Variant[] = [
      { id: 'v1', seed: 'minimal', html: '<p>x</p>', rationale: 'r' },
    ];

    render(<App variants={variants} />);

    const iframe = screen.getByTitle('minimal');

    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
  });
});
