/**
 * @chief-clancy/terminal
 *
 * Installer, slash commands, hooks, AFK runner, agents,
 * and Claude CLI bridge.
 */
export { PACKAGE_NAME as CORE_PACKAGE_NAME } from '@chief-clancy/core';

export const PACKAGE_NAME = '@chief-clancy/terminal' as const;

export {
  blue,
  bold,
  cyan,
  dim,
  green,
  red,
  yellow,
} from './shared/ansi/index.js';
