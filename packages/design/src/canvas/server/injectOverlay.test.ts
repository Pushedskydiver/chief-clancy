import type { ViteDevServer } from 'vite';

import { createServer as createViteServer } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';

import { injectOverlay, OVERLAY_CLIENT_PATH } from './injectOverlay.js';

let server: ViteDevServer | null = null;

const startTestServer = async (): Promise<ViteDevServer> => {
  server = await createViteServer({
    configFile: false,
    root: process.cwd(),
    logLevel: 'silent',
    server: { middlewareMode: true },
    plugins: [injectOverlay()],
  });
  return server;
};

afterEach(async () => {
  if (server !== null) {
    await server.close();
    server = null;
  }
});

describe('injectOverlay', () => {
  it('injects a module-script tag pointing at the overlay client into served HTML', async () => {
    const created = await startTestServer();
    const html = '<!doctype html><html><body></body></html>';

    const result = await created.transformIndexHtml('/index.html', html);

    expect(result).toContain(`src="${OVERLAY_CLIENT_PATH}"`);
    expect(result).toMatch(/type="module"/);
  });

  it('places the overlay script inside the body so the client sees the variant DOM at load time', async () => {
    const created = await startTestServer();
    const html =
      '<!doctype html><html><head><title>fixture</title></head><body><p>variant</p></body></html>';

    const result = await created.transformIndexHtml('/index.html', html);

    const scriptIndex = result.indexOf(`src="${OVERLAY_CLIENT_PATH}"`);
    const bodyOpenIndex = result.indexOf('<body');
    const bodyCloseIndex = result.indexOf('</body>');
    expect(scriptIndex).toBeGreaterThan(bodyOpenIndex);
    expect(scriptIndex).toBeLessThan(bodyCloseIndex);
  });
});
