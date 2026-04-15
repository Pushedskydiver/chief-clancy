/**
 * @chief-clancy/terminal
 *
 * Installer, slash commands, hooks, AFK runner, agents,
 * and Claude CLI bridge.
 */
export const PACKAGE_NAME = '@chief-clancy/terminal' as const;

export { copyDir, inlineWorkflows } from './installer/file-ops.js';
export { installHooks } from './installer/hook-installer.js';
export type {
  InstallMode,
  InstallPaths,
  RunInstallOptions,
} from './installer/install/install.js';
export {
  parseEnabledRoles,
  parseInstallFlag,
  resolveInstallPaths,
  runInstall,
} from './installer/install/install.js';
export { validateSources } from './installer/install/validate-sources.js';
export {
  backupModifiedFiles,
  buildManifest,
  detectModifiedFiles,
} from './installer/manifest.js';
export { createPrompts } from './installer/prompts.js';
export { copyRoleFiles } from './installer/role-filter.js';
export { printBanner, printSuccess } from './installer/ui.js';

export { blue, bold, cyan, dim, green, red, yellow } from './shared/ansi.js';

export { runAutopilot } from './runner/autopilot.js';
export {
  buildPipelineDeps,
  buildPrompt,
  buildReworkPrompt,
  invokeClaudePrint,
  invokeClaudeSession,
  sendNotification,
} from '@chief-clancy/dev';
export { runImplement } from './runner/implement/implement.js';
export {
  buildSessionReport,
  generateSessionReport,
} from './runner/session-report.js';
