/**
 * Interactive CLI prompt helpers for the installer.
 *
 * Uses dependency injection for the readline interface — no module-scoped
 * side effects. The caller creates and owns the readline lifecycle.
 */

import { blue, cyan } from '~/shared/ansi/index.js';

/**
 * Minimal readline interface required by the prompts module.
 *
 * Accepts any object with `question` and `close` — works with
 * `node:readline` createInterface or a test double.
 */
type ReadlineInterface = {
  readonly question: (
    query: string,
    callback: (answer: string) => void,
  ) => void;
  readonly close: () => void;
};

/** Public API returned by {@link createPrompts}. */
type PromptApi = {
  /** Prompt the user for text input. */
  readonly ask: (label: string) => Promise<string>;
  /** Present a numbered list of options and return the user's choice. */
  readonly choose: (
    question: string,
    options: readonly string[],
    defaultChoice?: number,
  ) => Promise<string>;
  /** Close the underlying readline interface. */
  readonly close: () => void;
};

/**
 * Create a prompt API backed by the given readline interface.
 *
 * @param rl - A readline-compatible interface (injected for testability).
 * @returns An object with `ask`, `choose`, and `close` methods.
 */
export function createPrompts(rl: ReadlineInterface): PromptApi {
  const ask = (label: string): Promise<string> =>
    new Promise((resolve) => rl.question(label, resolve));

  const choose = async (
    question: string,
    options: readonly string[],
    defaultChoice = 1,
  ): Promise<string> => {
    console.log('');
    console.log(blue(question));
    console.log('');
    options.forEach((opt, i) => console.log(`  ${i + 1}) ${opt}`));
    console.log('');
    const raw = await ask(cyan(`Choice [${defaultChoice}]: `));
    return raw.trim() || String(defaultChoice);
  };

  const close = (): void => rl.close();

  return { ask, choose, close };
}
