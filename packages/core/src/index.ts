/**
 * @chief-clancy/core
 *
 * Board intelligence, schemas, types, ticket lifecycle, phase pipeline,
 * and shared utilities.
 */
export const PACKAGE_NAME = '@chief-clancy/core' as const;

export type { EnvFileSystem } from './shared/env-parser/index.js';
export { loadClancyEnv, parseEnvContent } from './shared/env-parser/index.js';
