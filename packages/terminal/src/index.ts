/**
 * @chief-clancy/terminal
 *
 * Installer, slash commands, hooks, AFK runner, agents,
 * and Claude CLI bridge.
 */
export const PACKAGE_NAME = '@chief-clancy/terminal' as const;

export { copyDir, inlineWorkflows } from './installer/file-ops/index.js';
export { installHooks } from './installer/hook-installer/index.js';
export type {
  InstallMode,
  InstallPaths,
  RunInstallOptions,
} from './installer/install/index.js';
export {
  parseEnabledRoles,
  parseInstallFlag,
  resolveInstallPaths,
  runInstall,
  validateSources,
} from './installer/install/index.js';
export {
  backupModifiedFiles,
  buildManifest,
  detectModifiedFiles,
} from './installer/manifest/index.js';
export { createPrompts } from './installer/prompts/index.js';
export { copyRoleFiles } from './installer/role-filter/index.js';
export { printBanner, printSuccess } from './installer/ui/index.js';

export {
  blue,
  bold,
  cyan,
  dim,
  green,
  red,
  yellow,
} from './shared/ansi/index.js';

export { runAutopilot } from './runner/autopilot/index.js';
export {
  buildPipelineDeps,
  invokeClaudePrint,
  invokeClaudeSession,
  sendNotification,
} from '@chief-clancy/dev';
export { runImplement } from './runner/implement/index.js';
export {
  buildPrompt,
  buildReworkPrompt,
} from './runner/prompt-builder/index.js';
export {
  buildSessionReport,
  generateSessionReport,
} from './runner/session-report/index.js';
