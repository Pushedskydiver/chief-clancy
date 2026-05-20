import type { Variant } from '../generate/types.js';
import type { ReactElement } from 'react';

type AppProps = {
  readonly variants?: readonly Variant[];
};

/**
 * Canvas SPA shell.
 *
 * Phase F slice 14: variant iframes inside the variant grid, one per Variant.
 * Each iframe loads from a route the canvas server will own (a subsequent
 * server-side slice ships the route handler alongside the overlay-injection
 * plugin per spec §Phase F build order row 15). Until that lands the iframes
 * have a broken `src` in a real browser; the React tree + attribute wiring
 * is verified via RTL in jsdom.
 *
 * `title` attribute carries the variant's seed name per spec §13(e)
 * "Canvas-itself accessibility" — screen readers announce iframes by title,
 * so the announced label must be a human-meaningful aesthetic direction
 * (an entry from `ANTHROPIC_AESTHETIC_TAXONOMY`, e.g. `editorial/magazine`)
 * rather than an opaque session-scoped id.
 *
 * `sandbox="allow-scripts"` (no `allow-same-origin`) gives LLM-generated
 * variant HTML a unique opaque origin: variant JavaScript runs (needed for
 * variant interactivity + overlay-injection + postMessage element-pick),
 * but the variant cannot navigate the top, submit forms, open popups,
 * trigger downloads, or read parent cookies / localStorage. The postMessage
 * channel that ships the element-pick payload (spec §Element-pick mechanism)
 * crosses the sandbox boundary, but the spec's L154-158 pseudocode hard-codes
 * `targetOrigin: window.location.origin` which under this sandbox resolves
 * to the literal string `"null"` — the receiving slice that wires the
 * channel must use `targetOrigin: "*"` and validate at the parent via
 * `event.source === iframe.contentWindow`. Spec pseudocode predates the
 * sandbox decision and will need amendment when the channel lands.
 */
export const App = ({ variants = [] }: AppProps): ReactElement => (
  <main>
    <section aria-label="Chat panel" />
    <section aria-label="Variant grid">
      {variants.map((variant) => (
        <iframe
          key={variant.id}
          title={variant.seed}
          src={`/variants/${variant.id}`}
          sandbox="allow-scripts"
        />
      ))}
    </section>
  </main>
);
