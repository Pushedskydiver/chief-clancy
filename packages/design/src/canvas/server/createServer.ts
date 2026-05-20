import type { MessagesClient } from '../../generate/types.js';
import type { CanvasLock } from './lock.js';
import type { InlineConfig } from 'vite';

import { fileURLToPath } from 'node:url';

import Anthropic from '@anthropic-ai/sdk';
import { createServer as createViteServer } from 'vite';

import { injectOverlay } from './injectOverlay.js';
import { acquireCanvasLock } from './lock.js';

export class CanvasApiKeyError extends Error {
  constructor() {
    super(
      'No Anthropic API key found. Set via `--api-key` or `ANTHROPIC_API_KEY` before starting the design canvas.',
    );
    this.name = 'CanvasApiKeyError';
  }
}

type ResolveAnthropicApiKeyOptions = {
  readonly explicitApiKey?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
};

type ResolvedAnthropicApiKey = {
  readonly apiKey: string;
  readonly source: 'flag' | 'env';
};

const nonEmpty = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
};

export const resolveAnthropicApiKey = (
  options: ResolveAnthropicApiKeyOptions = {},
): ResolvedAnthropicApiKey => {
  const flagKey = nonEmpty(options.explicitApiKey);
  if (flagKey !== null) return { apiKey: flagKey, source: 'flag' };

  const envKey = nonEmpty(options.env?.ANTHROPIC_API_KEY);
  if (envKey !== null) return { apiKey: envKey, source: 'env' };

  throw new CanvasApiKeyError();
};

const DEFAULT_PORT = 4173;

type CanvasViteServer = {
  readonly resolvedUrls?: { readonly local?: readonly string[] } | null;
  readonly listen: () => Promise<unknown>;
  readonly close: () => Promise<unknown>;
};

type CreateViteServer = (config: InlineConfig) => Promise<CanvasViteServer>;

type SignalName = 'SIGINT' | 'SIGTERM';

type SignalRegistrar = {
  readonly once: (signal: SignalName, listener: () => void) => void;
  readonly prependOnceListener?: (
    signal: SignalName,
    listener: () => void,
  ) => void;
};

type StartCanvasServerOptions = {
  readonly projectRoot: string;
  readonly sessionId: string;
  readonly port?: number;
  readonly apiKey?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly now?: Date;
  readonly processExists?: (pid: number) => boolean;
  readonly createViteServer?: CreateViteServer;
  readonly registerSignals?: false | SignalRegistrar;
};

type StartedCanvasServer = {
  readonly server: CanvasViteServer;
  readonly messagesClient: MessagesClient;
  readonly url: string;
  readonly lockPath: string;
  readonly apiKeySource: ResolvedAnthropicApiKey['source'];
  readonly close: () => Promise<void>;
};

const canvasRoot = (): string => fileURLToPath(new URL('..', import.meta.url));

const createAnthropicMessagesClient = (apiKey: string): MessagesClient =>
  new Anthropic({ apiKey }).messages;

const createCanvasClose =
  (
    getServer: () => CanvasViteServer | null,
    lock: CanvasLock,
  ): (() => Promise<void>) =>
  async (): Promise<void> => {
    const server = getServer();
    try {
      if (server !== null) await server.close();
    } finally {
      await lock.release();
    }
  };

const registerCanvasSignalHandlers = (
  signalRegistrar: SignalRegistrar,
  lock: CanvasLock,
  close: () => Promise<void>,
): void => {
  const handleSignal = (): void => {
    // Vite may also register signal handlers. Remove the lock synchronously
    // before waiting on server.close() so a foreground process cannot exit
    // with a stale lock if another handler exits first.
    lock.releaseSync();
    close()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`canvas shutdown failed: ${message}\n`);
        process.exit(1);
      });
  };
  const register =
    signalRegistrar.prependOnceListener?.bind(signalRegistrar) ??
    signalRegistrar.once.bind(signalRegistrar);
  register('SIGINT', handleSignal);
  register('SIGTERM', handleSignal);
};

const buildViteConfig = (port: number): InlineConfig => ({
  root: canvasRoot(),
  clearScreen: false,
  logLevel: 'error',
  plugins: [injectOverlay()],
  server: {
    host: '127.0.0.1',
    port,
    strictPort: false,
  },
});

const createListeningViteServer = async (
  createServer: CreateViteServer,
  config: InlineConfig,
): Promise<CanvasViteServer> => {
  const server = await createServer(config);
  try {
    await server.listen();
    return server;
  } catch (err) {
    await server.close().catch(() => undefined);
    throw err;
  }
};

export const startCanvasServer = async (
  options: StartCanvasServerOptions,
): Promise<StartedCanvasServer> => {
  const port = options.port ?? DEFAULT_PORT;
  const resolvedApiKey = resolveAnthropicApiKey({
    explicitApiKey: options.apiKey,
    env: options.env ?? process.env,
  });
  const messagesClient = createAnthropicMessagesClient(resolvedApiKey.apiKey);
  const lock = await acquireCanvasLock({
    projectRoot: options.projectRoot,
    sessionId: options.sessionId,
    now: options.now,
    processExists: options.processExists,
  });

  // Register signal handlers immediately after lock acquisition so a Ctrl-C
  // during `vite.createServer()` / `server.listen()` still triggers
  // synchronous lock cleanup. The handlers close over a mutable ref that is
  // populated once Vite is listening; until then `close` just releases the
  // lock without touching the (not-yet-created) server.
  const serverRef: { current: CanvasViteServer | null } = { current: null };
  const close = createCanvasClose(() => serverRef.current, lock);
  const signalRegistrar =
    options.registerSignals === undefined ? process : options.registerSignals;
  if (signalRegistrar !== false) {
    registerCanvasSignalHandlers(signalRegistrar, lock, close);
  }

  try {
    const createServer = options.createViteServer ?? createViteServer;
    const server = await createListeningViteServer(
      createServer,
      buildViteConfig(port),
    );
    // Populated once on listen-success; signal handlers read it via the
    // `() => serverRef.current` closure to know whether to call `server.close()`
    // before releasing the lock.
    // eslint-disable-next-line functional/immutable-data
    serverRef.current = server;

    return {
      server,
      messagesClient,
      url: server.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${port}/`,
      lockPath: lock.lockPath,
      apiKeySource: resolvedApiKey.source,
      close,
    };
  } catch (err) {
    await lock.release();
    throw err;
  }
};
