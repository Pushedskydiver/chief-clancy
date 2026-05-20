// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  attachOverlay,
  computeStableSelector,
  extractVariantId,
} from './overlay.client.js';

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
    const overlay = attachOverlay(win, { variantId: 'v1' });
    overlay.setPickMode(true);

    const button = document.createElement('button');
    button.textContent = 'Submit application now';
    document.body.appendChild(button);
    button.click();

    expect(parentPostMessage).toHaveBeenCalledTimes(1);
    const [payload, targetOrigin] = parentPostMessage.mock.calls[0];
    expect(targetOrigin).toBe('*');
    expect(payload).toMatchObject({
      type: 'clancy:design:element-picked',
      variantId: 'v1',
      anchor: {
        tag: 'button',
        textSnippet: 'Submit application now',
        selector: 'body > button',
      },
    });
    expect(
      (payload as { anchor: { boundingBox: unknown } }).anchor.boundingBox,
    ).toBeDefined();

    overlay.detach();
  });

  it('cancels the click via preventDefault + stopPropagation so the variant does not handle it itself', () => {
    const { win } = setupIframeWindow();
    const overlay = attachOverlay(win, { variantId: 'v1' });
    overlay.setPickMode(true);

    const button = document.createElement('button');
    document.body.appendChild(button);
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');
    button.dispatchEvent(clickEvent);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(clickEvent.defaultPrevented).toBe(true);

    overlay.detach();
  });

  it('truncates the textSnippet at 32 characters so long element text does not flood postMessage payloads', () => {
    const { win, parentPostMessage } = setupIframeWindow();
    const overlay = attachOverlay(win, { variantId: 'v1' });
    overlay.setPickMode(true);

    const long = 'A'.repeat(64);
    const button = document.createElement('button');
    button.textContent = long;
    document.body.appendChild(button);
    button.click();

    const payload = parentPostMessage.mock.calls[0]?.[0] as {
      anchor: { textSnippet: string };
    };
    expect(payload.anchor.textSnippet).toHaveLength(32);
    expect(payload.anchor.textSnippet).toBe('A'.repeat(32));

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

describe('extractVariantId', () => {
  it('parses a variant id from /variants/<id> URLs (trailing-slash tolerant)', () => {
    expect(extractVariantId('/variants/v1')).toBe('v1');
    expect(extractVariantId('/variants/v1/')).toBe('v1');
  });

  it('returns null for non-matching pathnames so the bootstrap fails-closed', () => {
    expect(extractVariantId('/')).toBeNull();
    expect(extractVariantId('/variants/')).toBeNull();
    expect(extractVariantId('/variants/a/b')).toBeNull();
  });

  it('decodes percent-encoded characters in the captured id', () => {
    expect(extractVariantId('/variants/editorial%2Fmagazine%23abc')).toBe(
      'editorial/magazine#abc',
    );
  });

  it('returns null instead of throwing on malformed percent-escapes (fail-closed for the bootstrap)', () => {
    expect(extractVariantId('/variants/%E0%A4%A')).toBeNull();
  });
});
