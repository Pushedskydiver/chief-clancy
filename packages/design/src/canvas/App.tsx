import type { Variant } from '../generate/types.js';
import type { IframeMap } from './hooks/useElementPickedReceiver.js';
import type { ReactElement, RefCallback } from 'react';

import { useMemo, useState } from 'react';

import { CommentModal } from './components/molecules/CommentModal.js';
import { useElementPickedReceiver } from './hooks/useElementPickedReceiver.js';

type AppProps = {
  readonly variants?: readonly Variant[];
};

type SetIframesUpdater = (updater: (prev: IframeMap) => IframeMap) => void;

const removeFromIframeMap = (
  iframes: IframeMap,
  variantId: string,
): IframeMap =>
  Object.fromEntries(
    Object.entries(iframes).filter(([id]) => id !== variantId),
  );

/**
 * Create a stable ref callback for a single variant's iframe.
 *
 * Uses the React 19 ref-callback cleanup-return form: the callback runs
 * on attach with the element, and the returned cleanup function runs on
 * detach. The legacy `(element) => element === null ? detach : attach`
 * shape still works but is documented as removal-target in a future React
 * version. State updates are immutable: attach spreads a new record;
 * detach filters via `Object.fromEntries(Object.entries(...).filter(...))`.
 * No `Map.set` / `Map.delete` mutations — the codebase's
 * `functional/immutable-data` rule disallows them and the immutable shape
 * composes cleanly with the receiver's `useEffect` dependency array.
 */
const createIframeRefCallback = (
  variantId: string,
  setIframes: SetIframesUpdater,
): RefCallback<HTMLIFrameElement> => {
  return (element) => {
    // React 19 ref-callback cleanup-return: React calls this once with the
    // element on attach + invokes the returned cleanup on detach; it does
    // NOT call back with `null` to signal detach. The TypeScript signature
    // (`RefCallback<T>`) still admits `null` for back-compat — narrow here.
    if (element === null) return;
    setIframes((prev) => ({ ...prev, [variantId]: element }));
    return () => {
      setIframes((prev) => removeFromIframeMap(prev, variantId));
    };
  };
};

/**
 * Build stable ref callbacks keyed by variantId.
 *
 * Inline `ref={(el) => setIframes(...)}` reallocates the callback every
 * render, which React 19 treats as a ref change → detach (`ref(null)`) +
 * attach (`ref(element)`); combined with `setIframes` triggering a
 * re-render the cycle compounds into an infinite update loop. Memoising
 * the callback bag by `variants` gives React a stable identity per
 * variantId — attach fires exactly once per mount, detach exactly once
 * per unmount, no resonance. The React 19 compiler would auto-memoise the
 * inline form and obviate this, but `babel-plugin-react-compiler` is not
 * configured anywhere in the build pipeline (Vite, Vitest, or `tsc`).
 */
const buildIframeRefCallbacks = (
  variants: readonly Variant[],
  setIframes: SetIframesUpdater,
): Readonly<Record<string, RefCallback<HTMLIFrameElement>>> =>
  Object.fromEntries(
    variants.map((variant) => [
      variant.id,
      createIframeRefCallback(variant.id, setIframes),
    ]),
  );

/**
 * Canvas SPA shell.
 *
 * Renders the chat panel + variant grid regions, one
 * `<iframe sandbox="allow-scripts">` per variant (with the seed as
 * `title` for screen-reader announcement), wires the parent-side receiver
 * for `clancy:design:element-picked` messages from the iframe-side
 * overlay, and renders the comment input modal anchored to the picked
 * element's bounding box.
 *
 * Iframe handles are tracked in a `Record<variantId, HTMLIFrameElement>`
 * `useState` updated via callback refs with object-spread immutable
 * transitions. The receiver's `useEffect` re-runs whenever the map
 * changes, so the listener always sees the current handle set;
 * re-registration is cheap (one `addEventListener` swap per variant
 * mount/unmount) and the `AbortController` cleanup is single-source-of-truth.
 *
 * **Contract: `variants` must be reference-stable across renders.** The
 * ref-callback memoisation pins identity by `variants` array reference, so
 * a parent that re-allocates `variants` every render forces detach+attach
 * + a brief window where in-flight postMessages can be dropped. Pass a
 * memoised or state-owned array.
 */
export const App = ({ variants = [] }: AppProps): ReactElement => {
  const [iframes, setIframes] = useState<IframeMap>({});
  const activeComment = useElementPickedReceiver(iframes);
  const iframeRefCallbacks = useMemo(
    () => buildIframeRefCallbacks(variants, setIframes),
    [variants],
  );

  return (
    <main>
      <section aria-label="Chat panel" />
      <section aria-label="Variant grid">
        {variants.map((variant) => (
          <iframe
            key={variant.id}
            ref={iframeRefCallbacks[variant.id]}
            title={variant.seed}
            src={`/variants/${variant.id}`}
            sandbox="allow-scripts"
          />
        ))}
      </section>
      {activeComment !== null ? (
        <CommentModal boundingBox={activeComment.anchor.boundingBox} />
      ) : null}
    </main>
  );
};
