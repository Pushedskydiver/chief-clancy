/**
 * Iframe-side overlay client for the Clancy element-pick channel.
 *
 * Runs INSIDE variant iframes (slice 14 mounts each variant in an
 * `<iframe sandbox="allow-scripts">`); slice 15's Vite plugin injects this
 * module as `<script type="module" src="/overlay/overlay.client.ts">` into
 * every transformed HTML response. When the parent canvas SPA toggles pick
 * mode on for a variant, click events inside that variant are captured here,
 * the clicked element's stable anchor is computed, and an
 * `clancy:design:element-picked` envelope is posted to the parent via
 * `window.parent.postMessage`.
 *
 * The postMessage contract is the Session 165 amendment to
 * `.claude/research/phase-f-design-system/path-b-local-spec.md` L135-200:
 * `targetOrigin` is `'*'` (variant iframes are opaque-origin under
 * `sandbox="allow-scripts"`, so `event.origin` checks are unusable), and the
 * security boundary lives on the parent side via
 * `event.source === iframe.contentWindow` identity matching. The parent →
 * iframe direction (pick-mode toggle) likewise relies on identity matching:
 * the iframe-side message listener verifies `event.source === window.parent`
 * before mutating any local state.
 *
 * **v0.1 scope-narrowed per spec L704 amendment**: ships the iframe-side
 * client + jsdom logic tests only. `serveSession.ts` route handler
 * (no test surface absent browser harness), Cypress/Playwright real-browser
 * harness (no infrastructure in repo), and the parent-side receiver wiring
 * (moved to slice 17 alongside the comment-input UI that consumes picked
 * elements) are all deferred. The module file exists + Vite serves it, but
 * the end-to-end flow `iframe loads → overlay fires → parent receives` is
 * not wired in v0.1 (slice 14's iframe `src` URLs still 404; documented at
 * `App.tsx:11-16`).
 */

const ELEMENT_PICKED_TYPE = 'clancy:design:element-picked';
const SET_PICK_MODE_TYPE = 'clancy:design:set-pick-mode';
const PICK_MODE_BODY_CLASS = 'clancy-pick-active';
const TEXT_SNIPPET_MAX = 32;

type ElementAnchor = {
  readonly selector: string;
  readonly tag: string;
  readonly textSnippet: string;
  readonly boundingBox: DOMRect;
};

type ElementPickedMessage = {
  readonly type: typeof ELEMENT_PICKED_TYPE;
  readonly variantId: string;
  readonly anchor: ElementAnchor;
};

type SetPickModeMessage = {
  readonly type: typeof SET_PICK_MODE_TYPE;
  readonly active: boolean;
};

type OverlayHandle = {
  readonly setPickMode: (active: boolean) => void;
  readonly detach: () => void;
};

type AttachOverlayOptions = {
  readonly variantId: string;
};

/**
 * Compute the strongest available stable selector for a clicked element.
 *
 * Preference order per spec L207-216 (Phase 2 "Stable selector preference"):
 * 1. `data-clancy-slot` attribute (preserved across variant regenerations
 *    when Claude is instructed to keep slot IDs).
 * 2. `id` attribute.
 * 3. `data-testid` attribute.
 * 4. Tag + nth-child path from the document root (fallback).
 */
export const computeStableSelector = (target: HTMLElement): string => {
  const slot = target.getAttribute('data-clancy-slot');
  if (slot !== null && slot.length > 0) return `[data-clancy-slot="${slot}"]`;

  if (target.id.length > 0) return `#${target.id}`;

  const testId = target.getAttribute('data-testid');
  if (testId !== null && testId.length > 0) return `[data-testid="${testId}"]`;

  return buildNthChildPath(target);
};

const collectSelectorSegments = (
  current: Element | null,
  acc: readonly string[],
): readonly string[] => {
  if (current === null || current.tagName === 'HTML') return acc;
  const tag = current.tagName.toLowerCase();
  const parent = current.parentElement;
  if (parent === null) return [tag, ...acc];
  const tagSiblings = Array.from(parent.children).filter(
    (child) => child.tagName === current.tagName,
  );
  const segment =
    tagSiblings.length === 1
      ? tag
      : `${tag}:nth-child(${tagSiblings.indexOf(current) + 1})`;
  return collectSelectorSegments(parent, [segment, ...acc]);
};

const buildNthChildPath = (target: HTMLElement): string =>
  collectSelectorSegments(target, []).join(' > ');

const computeAnchor = (target: HTMLElement): ElementAnchor => ({
  selector: computeStableSelector(target),
  tag: target.tagName.toLowerCase(),
  textSnippet: (target.textContent ?? '').slice(0, TEXT_SNIPPET_MAX),
  boundingBox: target.getBoundingClientRect(),
});

const isPickModeActive = (win: Window): boolean =>
  win.document.body.classList.contains(PICK_MODE_BODY_CLASS);

const setPickModeOnDocument = (win: Window, active: boolean): void => {
  win.document.body.classList.toggle(PICK_MODE_BODY_CLASS, active);
};

/**
 * Attach the overlay client to an iframe-context Window.
 *
 * Registers click + message listeners; returns a handle exposing
 * `setPickMode(active)` (called from inside the parent-side message handler
 * OR directly by callers in tests) and `detach()` (removes both listeners,
 * intended for hot-reload + test teardown).
 *
 * `options.variantId` identifies the variant this iframe is rendering; the
 * parent uses it to anchor incoming picks to the correct variant + comment
 * thread. The bootstrap at the bottom of this module derives `variantId`
 * from `window.location.pathname` (slice 16 v0.1 expects
 * `/variants/<variantId>` URLs from slice 17+'s `serveSession.ts`).
 */
export const attachOverlay = (
  win: Window,
  options: AttachOverlayOptions,
): OverlayHandle => {
  // Pick-mode state lives on `document.body.classList` rather than a closure-
  // captured `let`: the body class is the visual indicator (spec L235 polish
  // item — cursor/outline change when pick mode active) AND needs to be
  // readable from the click listener, so a closure-let would duplicate the
  // source of truth. classList.toggle is the same DOM mutation either way —
  // the difference is whether a `pickModeActive` field can drift from the
  // visual state.
  //
  // Single-realm contract: `win` is expected to be the realm in which this
  // module loaded. Cross-realm callers (e.g. a parent reaching into an
  // iframe's `contentWindow`) would not pass `target instanceof HTMLElement`
  // below because the module-global `HTMLElement` constructor differs across
  // realms. Slice 16's only caller is the module-bottom bootstrap which
  // passes its own `window`; later slices that wire across realms must
  // accept this constraint.
  const onClick = (event: Event): void => {
    if (!isPickModeActive(win)) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopPropagation();

    const message: ElementPickedMessage = {
      type: ELEMENT_PICKED_TYPE,
      variantId: options.variantId,
      anchor: computeAnchor(target),
    };
    win.parent.postMessage(message, '*');
  };

  const onMessage = (event: MessageEvent): void => {
    // Receiver-side identity check per amended Phase 2 contract: the parent
    // canvas SPA is the only window that should ever post to this iframe.
    // event.origin is "null" under sandbox="allow-scripts" opaque origin so
    // origin-matching is not a usable security boundary.
    if (event.source !== win.parent) return;

    const data = event.data as Partial<SetPickModeMessage> | null;
    if (data?.type === SET_PICK_MODE_TYPE && typeof data.active === 'boolean') {
      setPickModeOnDocument(win, data.active);
    }
  };

  win.addEventListener('click', onClick, { capture: true });
  win.addEventListener('message', onMessage);

  return {
    setPickMode: (active: boolean) => setPickModeOnDocument(win, active),
    detach: () => {
      win.removeEventListener('click', onClick, { capture: true });
      win.removeEventListener('message', onMessage);
    },
  };
};

export const extractVariantId = (pathname: string): string | null => {
  const match = /^\/variants\/([^/]+)\/?$/.exec(pathname);
  if (match === null) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    // Malformed %-escape sequence — fail-closed (no attach) so a bad URL
    // can't crash module evaluation and tear down the iframe's script tag.
    return null;
  }
};

// Auto-bootstrap when loaded inside a real iframe. In jsdom (where
// window.parent === window by default) and at module-import time in unit
// tests, this guard short-circuits — tests exercise the named exports
// directly without triggering side effects.
if (typeof window !== 'undefined' && window.parent !== window) {
  const variantId = extractVariantId(window.location.pathname);
  if (variantId !== null) attachOverlay(window, { variantId });
}
