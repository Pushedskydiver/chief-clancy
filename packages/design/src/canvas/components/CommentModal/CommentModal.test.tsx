// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { CommentModal } from './CommentModal.js';

afterEach(cleanup);

const defaultBoundingBox = {
  top: 100,
  left: 50,
  width: 80,
  height: 30,
} as const;

describe('CommentModal', () => {
  it('renders as a dialog with the comment-input accessible name', () => {
    render(<CommentModal boundingBox={defaultBoundingBox} />);

    const modal = screen.queryByRole('dialog', { name: /comment input/i });

    expect(modal).not.toBeNull();
  });

  it('positions the modal at (left, top + height) for picked-element anchoring', () => {
    render(<CommentModal boundingBox={defaultBoundingBox} />);

    const modal = screen.getByRole('dialog', { name: /comment input/i });

    // Inline style carries the anchor-structural declarations
    // (`position: fixed` + runtime-computed bbox coords). Theme-static
    // styling (size, padding, shadow) lives in the module CSS; jsdom does
    // not resolve module classes to computed style so we assert only on the
    // inline-visible surface.
    expect(modal.style.position).toBe('fixed');
    expect(modal.style.top).toBe('130px');
    expect(modal.style.left).toBe('50px');
  });

  it('renders a textarea inside the modal for typing the comment', () => {
    render(<CommentModal boundingBox={defaultBoundingBox} />);

    const modal = screen.getByRole('dialog', { name: /comment input/i });
    const textbox = within(modal).getByRole('textbox', {
      name: /comment text/i,
    });

    expect(textbox.tagName).toBe('TEXTAREA');
  });

  it('passes axe accessibility smoke check (ARIA roles + labels + role-hierarchy)', async () => {
    // jsdom limitations on axe: color-contrast + focus-visibility skip; this
    // smoke catches ARIA attribute validity, label existence, role hierarchy,
    // and accessible-name presence. Real-browser a11y verification is
    // Alex-side until playwright-axe lands.
    const { container } = render(
      <CommentModal boundingBox={defaultBoundingBox} />,
    );

    const results = await axe(container);

    expect(results.violations).toEqual([]);
  });
});
