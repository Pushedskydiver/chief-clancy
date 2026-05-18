/**
 * `clancy:design canvas` runtime handler — Phase F slice 12.
 *
 * Starts the foreground Vite canvas server for the current project. The
 * process intentionally stays alive until Ctrl-C / SIGTERM so users can keep
 * the canvas open while iterating. `waitForShutdown: false` exists only for
 * unit tests and future in-process callers; the bin path uses the foreground
 * default.
 *
 * **Shutdown resolver.** When `waitForShutdown !== false`, the function
 * registers `SIGINT`/`SIGTERM` handlers on the configurable `signalRegistrar`
 * (default `process`) and returns a Promise that resolves on first signal.
 * In production the `createServer`-side signal handlers fire first (they use
 * `prependOnceListener`) and call `process.exit(0)`, killing the process
 * before this Promise resolves — but the explicit resolver makes the
 * foreground-loop intent reader-clear and lets tests inject a fake
 * registrar to exercise the path without spawning a real subprocess.
 */
import { startCanvasServer } from '../canvas/server/createServer.js';

type Logger = (line: string) => void;
type StartServer = typeof startCanvasServer;

type SignalName = 'SIGINT' | 'SIGTERM';

type SignalRegistrar = {
  readonly once: (signal: SignalName, listener: () => void) => void;
};

type RunCanvasOptions = {
  readonly logger?: Logger;
  readonly apiKey?: string;
  readonly port?: number;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly sessionId?: string;
  readonly waitForShutdown?: boolean;
  readonly startServer?: StartServer;
  readonly signalRegistrar?: SignalRegistrar;
};

type RunCanvasResult = {
  readonly exitCode: number;
  readonly url: string;
  readonly lockPath: string;
};

const defaultLogger: Logger = (line) => {
  process.stdout.write(line + '\n');
};

const createSessionId = (): string => `canvas-${Date.now().toString(36)}`;

const waitForCanvasShutdown = (
  result: RunCanvasResult,
  signalRegistrar: SignalRegistrar,
): Promise<RunCanvasResult> =>
  new Promise<RunCanvasResult>((resolve) => {
    const handleSignal = (): void => resolve(result);
    signalRegistrar.once('SIGINT', handleSignal);
    signalRegistrar.once('SIGTERM', handleSignal);
  });

export async function runCanvas(
  projectRoot: string,
  options: RunCanvasOptions = {},
): Promise<RunCanvasResult> {
  const log = options.logger ?? defaultLogger;
  const startServer = options.startServer ?? startCanvasServer;

  log('Starting clancy:design canvas...');
  const canvas = await startServer({
    projectRoot,
    sessionId: options.sessionId ?? createSessionId(),
    apiKey: options.apiKey,
    port: options.port,
    env: options.env,
  });

  log('Clancy design canvas listening:');
  log(canvas.url);
  log('Press Ctrl-C to stop.');

  const result: RunCanvasResult = {
    exitCode: 0,
    url: canvas.url,
    lockPath: canvas.lockPath,
  };

  if (options.waitForShutdown === false) return result;

  return waitForCanvasShutdown(result, options.signalRegistrar ?? process);
}
