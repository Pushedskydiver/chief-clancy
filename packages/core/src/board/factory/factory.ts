/**
 * Board factory.
 *
 * Creates a Board implementation from a BoardConfig discriminated union.
 * Each case dispatches to the provider-specific factory function.
 */
import type { BoardConfig } from '~/c/schemas/env/env.js';
import type { Board } from '~/c/types/index.js';

import { createAzdoBoard } from '../azdo/azdo-board.js';
import { createGitHubBoard } from '../github/github-board.js';
import { createJiraBoard } from '../jira/jira-board.js';
import { createLinearBoard } from '../linear/linear-board.js';
import { createNotionBoard } from '../notion/notion-board.js';
import { createShortcutBoard } from '../shortcut/shortcut-board.js';

/**
 * Create a Board from a detected board configuration.
 *
 * @param config - The validated board config from `detectBoard`.
 * @returns A Board object for the configured provider.
 */
export function createBoard(config: BoardConfig): Board {
  switch (config.provider) {
    case 'jira':
      return createJiraBoard(config.env);
    case 'github':
      return createGitHubBoard(config.env);
    case 'linear':
      return createLinearBoard(config.env);
    case 'shortcut':
      return createShortcutBoard(config.env);
    case 'notion':
      return createNotionBoard(config.env);
    case 'azdo':
      return createAzdoBoard(config.env);
    default: {
      const _exhaustive: never = config;
      return _exhaustive;
    }
  }
}
