import type { Plugin } from 'vite';

/**
 * Filesystem-relative path Vite serves the overlay client from.
 *
 * Resolved against the canvas server's `root` (`packages/design/src/canvas/`)
 * — slice 16 will populate `overlay/overlay.client.ts` with the postMessage
 * + click-handler logic per spec Phase 2 (Element-pick without browser
 * extension) at `.claude/research/phase-f-design-system/path-b-local-spec.md`
 * L135-200. Until then any browser request for this path 404s; slice 15's
 * contract is purely "the script tag is present in served HTML responses."
 */
export const OVERLAY_CLIENT_PATH = '/overlay/overlay.client.ts';

/**
 * Vite plugin registering a `transformIndexHtml` hook that injects the Clancy
 * overlay-client script tag into any HTML response Vite's HTML pipeline
 * transforms. End-to-end injection requires either an `index.html` at the
 * Vite `root` (`packages/design/src/canvas/`) or a route handler that calls
 * `server.transformIndexHtml(url, html)` — slice 16 lands the latter for
 * `/variants/<id>` so iframe content actually flows through this plugin.
 * Until that wiring lands the hook fires on zero real HTTP responses; the
 * plugin's contract is exercised today by the integration test's direct
 * `server.transformIndexHtml` invocation.
 *
 * The overlay client runs INSIDE variant iframes (slice 14's `App.tsx` mounts
 * each variant in an `<iframe sandbox="allow-scripts">`) and owns the
 * element-pick postMessage channel landing in slice 16. Slice 15 ships only
 * the build-time injection mechanism: each transformed HTML page gains a
 * `<script type="module">` tag whose `src` resolves to {@link OVERLAY_CLIENT_PATH}
 * — Vite's `transformIndexHtml` `tags` API does the splicing so this plugin
 * is a one-shot declaration of intent rather than a string-replace contract.
 *
 * The path-based approach over a virtual module ID keeps slice 16's filesystem
 * deliverable (`overlay/overlay.client.ts` per spec L60-61) addressable
 * end-to-end via the dev server without requiring this plugin to own the
 * `resolveId`/`load` hook pair.
 */
export const injectOverlay = (): Plugin => ({
  name: 'clancy:design:inject-overlay',
  transformIndexHtml() {
    return [
      {
        tag: 'script',
        attrs: { type: 'module', src: OVERLAY_CLIENT_PATH },
        injectTo: 'body',
      },
    ];
  },
});
