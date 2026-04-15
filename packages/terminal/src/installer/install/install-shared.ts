/**
 * Shared install types and constants — consumed by both the installer
 * orchestrator (`install.ts`) and the source-validation helper
 * (`validate-sources.ts`). Extracted to break the install ↔ validate-sources
 * cycle.
 */

/** Source directories within the npm package. */
export type InstallSources = {
  readonly rolesDir: string;
  readonly hooksDir: string;
  readonly bundleDir: string;
  readonly agentsDir: string;
  readonly briefCommandsDir?: string;
  readonly briefWorkflowsDir?: string;
  readonly briefAgentsDir?: string;
  readonly planCommandsDir?: string;
  readonly planWorkflowsDir?: string;
  readonly scanAgentsDir?: string;
  readonly scanCommandsDir?: string;
  readonly scanWorkflowsDir?: string;
};

export const BUNDLE_SCRIPTS = [
  'clancy-implement.js',
  'clancy-autopilot.js',
] as const;
