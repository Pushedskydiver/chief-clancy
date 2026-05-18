import type { startCanvasServer } from '../canvas/server/createServer.js';

import { describe, expect, it, vi } from 'vitest';

import { runCanvas } from './canvas.js';

type StartedCanvasServer = Awaited<ReturnType<typeof startCanvasServer>>;

describe('runCanvas', () => {
  it('starts the canvas server with CLI options, logs the URL, and returns when requested', async () => {
    const logs: string[] = [];
    const startServer = vi.fn(async () => {
      return {
        apiKeySource: 'flag',
        lockPath: '/tmp/project/.clancy/design/.lock',
        messagesClient: { create: vi.fn() },
        server: { listen: vi.fn(), close: vi.fn() },
        url: 'http://127.0.0.1:4173/',
        close: vi.fn(),
      } satisfies StartedCanvasServer;
    });

    const result = await runCanvas('/tmp/project', {
      apiKey: 'test-key',
      logger: (line) => logs.push(line),
      port: 4174,
      sessionId: 'session-123',
      startServer,
      waitForShutdown: false,
    });

    expect(startServer).toHaveBeenCalledWith({
      apiKey: 'test-key',
      env: undefined,
      port: 4174,
      projectRoot: '/tmp/project',
      sessionId: 'session-123',
    });
    expect(logs).toEqual([
      'Starting clancy:design canvas...',
      'Clancy design canvas listening:',
      'http://127.0.0.1:4173/',
      'Press Ctrl-C to stop.',
    ]);
    expect(result).toEqual({
      exitCode: 0,
      lockPath: '/tmp/project/.clancy/design/.lock',
      url: 'http://127.0.0.1:4173/',
    });
  });

  it('resolves the foreground-loop Promise on injected SIGINT', async () => {
    const startServer = vi.fn(async () => {
      return {
        apiKeySource: 'env',
        lockPath: '/tmp/p/.clancy/design/.lock',
        messagesClient: { create: vi.fn() },
        server: { listen: vi.fn(), close: vi.fn() },
        url: 'http://127.0.0.1:4173/',
        close: vi.fn(),
      } satisfies StartedCanvasServer;
    });

    const sigintListeners: (() => void)[] = [];
    const signalRegistrar = {
      once: (signal: 'SIGINT' | 'SIGTERM', listener: () => void) => {
        if (signal === 'SIGINT') {
          sigintListeners.push(listener);
        }
      },
    };

    const pending = runCanvas('/tmp/p', {
      logger: () => undefined,
      startServer,
      signalRegistrar,
    });

    // Fire SIGINT after the registrar has captured listeners.
    await Promise.resolve();
    sigintListeners.forEach((listener) => listener());

    await expect(pending).resolves.toEqual({
      exitCode: 0,
      lockPath: '/tmp/p/.clancy/design/.lock',
      url: 'http://127.0.0.1:4173/',
    });
  });
});
