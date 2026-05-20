// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { attachOverlay, computeStableSelector } from './overlay.client.js';

const setupIframeWindow = (): {
  readonly win: Window & typeof globalThis;
  readonly parentPostMessage: ReturnType<typeof vi.fn>;
  readonly parentRef: { readonly postMessage: ReturnType<typeof vi.fn> };
} => {
  const parentPostMessage = vi.fn();
  const parentRef = { postMessage: parentPostMessage };
  Object.defineProperty(window, 'parent', {
    configurable: true,
    value: parentRef,
  });
  return { win: window, parentPostMessage, parentRef };
};

afterEach(() => {
  document.body.innerHTML = '';
  document.body.className = '';
  Object.defineProperty(window, 'parent', {
    configurable: true,
    value: window,
  });
});

describe('attachOverlay', () => {
  it('posts an element-picked message to the parent when an element is clicked in pick mode', () => {
    const { win, parentPostMessage } = setupIframeWindow();
    const overlay = attachOverlay(win, { variantId: 'editorial/magazine#abc' });
    overlay.setPickMode(true);

    const button = document.createElement('button');
    button.textContent = 'Submit application now';
    document.body.appendChild(button);
    button.click();

    expect(parentPostMessage).toHaveBeenCalledTimes(1);
    expect(parentPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'clancy:design:element-picked',
        variantId: 'editorial/magazine#abc',
        anchor: expect.objectContaining({
          tag: 'button',
          textSnippet: 'Submit application now',
        }),
      }),
      '*',
    );

    overlay.detach();
  });

  it('does not post when pick mode is off (gate must prevent silent picks during normal variant interaction)', () => {
    const { win, parentPostMessage } = setupIframeWindow();
    const overlay = attachOverlay(win, { variantId: 'v1' });

    const button = document.createElement('button');
    document.body.appendChild(button);
    button.click();

    expect(parentPostMessage).not.toHaveBeenCalled();
    overlay.detach();
  });

  it('honours set-pick-mode messages only when the sender is the parent window (identity boundary under opaque-origin sandbox)', () => {
    const { win, parentPostMessage, parentRef } = setupIframeWindow();
    const overlay = attachOverlay(win, { variantId: 'v1' });

    win.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'clancy:design:set-pick-mode', active: true },
        source: { fake: 'attacker' } as unknown as MessageEventSource,
      }),
    );

    document.body.appendChild(document.createElement('button'));
    document.body.lastElementChild?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(parentPostMessage).not.toHaveBeenCalled();

    win.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'clancy:design:set-pick-mode', active: true },
        source: parentRef as unknown as MessageEventSource,
      }),
    );

    document.body.lastElementChild?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(parentPostMessage).toHaveBeenCalledTimes(1);

    overlay.detach();
  });

  it('removes click + message listeners on detach so a teared-down overlay never posts', () => {
    const { win, parentPostMessage } = setupIframeWindow();
    const overlay = attachOverlay(win, { variantId: 'v1' });
    overlay.setPickMode(true);
    overlay.detach();

    const button = document.createElement('button');
    document.body.appendChild(button);
    button.click();

    expect(parentPostMessage).not.toHaveBeenCalled();
  });
});

describe('computeStableSelector', () => {
  it('prefers data-clancy-slot — survives Claude variant regeneration when slot IDs are preserved', () => {
    const el = document.createElement('div');
    el.id = 'fallback';
    el.setAttribute('data-clancy-slot', 'abc123');
    el.setAttribute('data-testid', 'fallback');

    expect(computeStableSelector(el)).toBe('[data-clancy-slot="abc123"]');
  });

  it('falls back to id when data-clancy-slot is absent', () => {
    const el = document.createElement('div');
    el.id = 'user-id';
    el.setAttribute('data-testid', 'fallback');

    expect(computeStableSelector(el)).toBe('#user-id');
  });

  it('falls back to data-testid when slot + id are absent', () => {
    const el = document.createElement('button');
    el.setAttribute('data-testid', 'submit-button');

    expect(computeStableSelector(el)).toBe('[data-testid="submit-button"]');
  });

  it('falls back to tag + nth-child path when no stable attribute is available', () => {
    document.body.innerHTML =
      '<main><section><button></button><button></button></section></main>';
    const main = document.querySelector('main');
    const section = main?.querySelector('section');
    const secondButton = section?.querySelectorAll('button')[1];
    if (!(secondButton instanceof HTMLElement)) throw new Error('fixture');

    expect(computeStableSelector(secondButton)).toBe(
      'body > main > section > button:nth-child(2)',
    );
  });
});
