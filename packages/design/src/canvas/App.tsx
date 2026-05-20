import type { ReactElement } from 'react';

/**
 * Canvas SPA shell.
 *
 * Phase F slice 13: layout regions only. Chat panel and variant grid render
 * empty — content arrives in subsequent slices (variant iframe rendering at
 * slice 14, comment UI at slice 17, regeneration loop at slice 19).
 */
export const App = (): ReactElement => (
  <main>
    <section aria-label="Chat panel" />
    <section aria-label="Variant grid" />
  </main>
);
