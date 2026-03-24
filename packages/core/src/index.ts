/**
 * @chief-clancy/core
 *
 * Board intelligence, schemas, types, ticket lifecycle, phase pipeline,
 * and shared utilities.
 */
export const PACKAGE_NAME = '@chief-clancy/core' as const;

export type { EnvFileSystem } from './shared/env-parser/index.js';
export { loadClancyEnv, parseEnvContent } from './shared/env-parser/index.js';

export type {
  BitbucketRemote,
  BitbucketServerRemote,
  Board,
  BoardProvider,
  ChildrenStatus,
  FetchedTicket,
  FetchTicketOpts,
  GenericRemote,
  GitHubRemote,
  GitLabRemote,
  GitPlatform,
  NoRemote,
  PingResult,
  PrCreationFailure,
  PrCreationResult,
  PrCreationSuccess,
  PrReviewState,
  ProgressStatus,
  RemoteInfo,
  Ticket,
} from './types/index.js';
export {
  COMPLETED_STATUSES,
  DELIVERED_STATUSES,
  FAILED_STATUSES,
} from './types/index.js';

export type {
  AzdoEnv,
  BoardConfig,
  GitHubEnv,
  JiraEnv,
  LinearEnv,
  NotionEnv,
  SharedEnv,
  ShortcutEnv,
} from './schemas/index.js';
export {
  azdoEnvSchema,
  githubEnvSchema,
  jiraEnvSchema,
  linearEnvSchema,
  notionEnvSchema,
  sharedEnvSchema,
  shortcutEnvSchema,
} from './schemas/index.js';

export { detectBoard, sharedEnv } from './board/index.js';
