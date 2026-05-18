/**
 * `clancy:design canvas` runtime handler — Phase F slice 12.
 *
 * Starts the foreground Vite canvas server for the current project. The
 * process intentionally stays alive until Ctrl-C / SIGTERM so users can keep
 * the canvas open while iterating. `waitForShutdown: false` exists only for
 * unit tests and future in-process callers; the bin path uses the foreground
 * default.
 */
import { startCanvasServer } from '../canvas/server/createServer.js';

type Logger = (line: string) => void;
type StartServer = typeof startCanvasServer;

type RunCanvasOptions = {
  readonly logger?: Logger;
  readonly apiKey?: string;
  readonly port?: number;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly sessionId?: string;
  readonly waitForShutdown?: boolean;
  readonly startServer?: StartServer;
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

  if (options.waitForShutdown === false) {
    return { exitCode: 0, url: canvas.url, lockPath: canvas.lockPath };
  }

  return new Promise<RunCanvasResult>(() => {});
}
