/**
 * `clancy:design init` runtime handler — Phase F slice 9.
 *
 * Walks a 6-question grill (audience, brand voice, aesthetic direction from
 * the Anthropic frontend-design SKILL.md taxonomy, scale family, theme,
 * anti-references) and writes greenfield `.clancy/docs/{DESIGN.md,PRODUCT.md}`.
 *
 * The prompter is dependency-injected via `options.prompter` so unit + E2E
 * tests can substitute canned answers. The default prompter wraps Node's
 * built-in `node:readline` (NOT `readline/promises` — see the
 * `createReadlinePrompter` TSDoc for why) — no external interactive-prompt
 * dep (greenfield v0.1 has 6 prompts; readline is sufficient; future slice
 * can swap for Inquirer if rendering UX warrants).
 *
 * Output ownership: design package owns DESIGN.md + PRODUCT.md (per the B2
 * ownership split documented in the parent spec); scan package continues to
 * own DESIGN-SYSTEM.md + ACCESSIBILITY.md unchanged.
 *
 * Slice 9 ships the greenfield grill only. Model-preference and API-key
 * bootstrap (path-b-local-spec §11 + ui-vision-spec §3 v0.5 amendment) are
 * deferred to dedicated future slices — extending `init` is non-breaking
 * since extensions only add side effects, not change the command surface.
 */
import type { GrillAnswers } from '../write/init.js';

import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createInterface } from 'node:readline';

import {
  ANTHROPIC_AESTHETIC_TAXONOMY,
  buildDesignMd,
  buildProductMd,
  SCALE_FAMILY_OPTIONS,
  THEME_OPTIONS,
} from '../write/init.js';

export type Prompter = {
  readonly ask: (prompt: string) => Promise<string>;
  readonly select: (
    prompt: string,
    options: readonly string[],
  ) => Promise<string>;
};

type Logger = (line: string) => void;

type RunInitOptions = {
  readonly prompter?: Prompter;
  readonly logger?: Logger;
};

type RunInitResult = {
  // Always 0 in v0.1 — the only failure surface (mkdir/writeFile reject,
  // prompter throws on stdin EOF) bubbles via thrown errors caught by the
  // bin's main().catch which exits with 1 directly. Field shape preserved
  // for parity with slice 8's `runDocument` return type.
  readonly exitCode: number;
  readonly designMdPath: string;
  readonly productMdPath: string;
};

const DOCS_DIR = join('.clancy', 'docs');
const DESIGN_MD = 'DESIGN.md';
const PRODUCT_MD = 'PRODUCT.md';

const defaultLogger: Logger = (line) => {
  process.stdout.write(line + '\n');
};

const renderSelectPrompt = (
  prompt: string,
  options: readonly string[],
): string => {
  const numbered = options.map((opt, i) => `  ${i + 1}) ${opt}`).join('\n');
  return `${prompt}\n${numbered}\nChoose 1-${options.length}: `;
};

// Strict numeric match — `parseInt('1.5')` returns 1, `parseInt('1abc')`
// returns 1; both would silently advance with the wrong semantic. Require
// digits-only so re-prompt fires on ambiguous input. Returns the 0-based
// index on valid in-range input, null otherwise.
const parseSelectIndex = (raw: string, optionCount: number): number | null => {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const idx = Number.parseInt(trimmed, 10) - 1;
  if (idx < 0 || idx >= optionCount) return null;
  return idx;
};

/**
 * Default prompter wrapping `node:readline`. Returns the prompter plus an
 * explicit `close()` for the caller to invoke (typically in a finally) so
 * the readline interface releases stdin and the Node process can exit cleanly.
 *
 * **Why `rl[Symbol.asyncIterator]()` rather than `readline/promises.question`:**
 * when stdin is piped (non-TTY — e.g. tests, scripted invocation), all input
 * lines arrive in a single 'data' chunk and `rl.question()` only listens for
 * the next 'line' event — lines 2+ fire before subsequent `rl.question()`
 * calls register listeners, so they're silently dropped. The async iterator
 * buffers all lines internally and yields them in order, decoupling readline's
 * burst delivery from our sequential awaits.
 */
const createReadlinePrompter = (): {
  readonly prompter: Prompter;
  readonly close: () => void;
} => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const lines = rl[Symbol.asyncIterator]();

  // Returns `null` on EOF (stdin closed / exhausted). Callers MUST treat
  // null as a fatal abort — silently substituting an empty string causes
  // `select`'s re-prompt loop to recurse unbounded on piped non-TTY input.
  // The microtask-paced recursion never overflows the stack but hangs the
  // process with promise-allocation churn.
  const nextLine = async (): Promise<string | null> => {
    const { value, done } = await lines.next();
    return done ? null : value;
  };

  const requireLine = async (): Promise<string> => {
    const line = await nextLine();
    if (line === null) {
      throw new Error(
        'clancy:design init: stdin closed mid-grill (no answer received). Re-run with all 6 answers piped or interact via a TTY.',
      );
    }
    return line;
  };

  const ask = async (prompt: string): Promise<string> => {
    process.stdout.write(`${prompt}\n> `);
    return (await requireLine()).trim();
  };

  const select = async (
    prompt: string,
    options: readonly string[],
  ): Promise<string> => {
    process.stdout.write(renderSelectPrompt(prompt, options));
    const raw = await requireLine();
    const idx = parseSelectIndex(raw, options.length);
    if (idx !== null) return options[idx];
    process.stdout.write(
      `  Invalid choice. Enter a number 1-${options.length}.\n`,
    );
    // Recursion replaces an imperative re-prompt loop. EOF cannot trap us
    // here: `requireLine` throws on stdin close, which propagates through
    // askGrill / collectAnswers / bin/design.js main().catch -> exit 1.
    return select(prompt, options);
  };

  return { prompter: { ask, select }, close: () => rl.close() };
};

const askGrill = async (prompter: Prompter): Promise<GrillAnswers> => {
  const audience = await prompter.ask(
    'Who is this product for? (e.g. "beginner web developers", "enterprise legal teams")',
  );
  const brandVoice = await prompter.ask(
    'How should this product sound? Tone, personality, positioning.',
  );
  const aesthetic = await prompter.select(
    'Aesthetic direction (from the Anthropic frontend-design taxonomy)',
    ANTHROPIC_AESTHETIC_TAXONOMY,
  );
  const scaleFamily = await prompter.select(
    'Scale family — how broad is the surface this design serves?',
    SCALE_FAMILY_OPTIONS,
  );
  const theme = await prompter.select('Theme support', THEME_OPTIONS);
  const antiReferences = await prompter.ask(
    'Anti-references — what should this product NOT be? Patterns to explicitly avoid.',
  );
  return {
    audience,
    brandVoice,
    aesthetic,
    scaleFamily,
    theme,
    antiReferences,
  };
};

const collectAnswers = async (
  prompter: Prompter,
  cleanup: () => void,
): Promise<GrillAnswers> => {
  try {
    return await askGrill(prompter);
  } finally {
    cleanup();
  }
};

export async function runInit(
  projectRoot: string,
  options: RunInitOptions = {},
): Promise<RunInitResult> {
  const log = options.logger ?? defaultLogger;

  // Default prompter owns its own readline lifecycle; DI'd prompter (from
  // tests or future callers) owns its own.
  const owned =
    options.prompter === undefined ? createReadlinePrompter() : null;
  const prompter = options.prompter ?? owned!.prompter;

  log('Running clancy:design init...');

  const answers = await collectAnswers(prompter, () => owned?.close());

  const generatedAt = new Date().toISOString();
  const designMd = buildDesignMd(answers, generatedAt);
  const productMd = buildProductMd(answers, generatedAt);

  const docsDir = join(projectRoot, DOCS_DIR);
  await mkdir(docsDir, { recursive: true });

  const designMdPath = join(docsDir, DESIGN_MD);
  const productMdPath = join(docsDir, PRODUCT_MD);

  // Sequential writes (DESIGN first, PRODUCT second) — same atomicity posture
  // as slice 7: re-run on partial failure since outputs are deterministic
  // from the same grill answers.
  await writeFile(designMdPath, designMd, 'utf8');
  await writeFile(productMdPath, productMd, 'utf8');

  log(`Wrote ${relative(projectRoot, designMdPath)}`);
  log(`Wrote ${relative(projectRoot, productMdPath)}`);

  return { exitCode: 0, designMdPath, productMdPath };
}
