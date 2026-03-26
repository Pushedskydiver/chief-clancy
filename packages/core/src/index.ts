/**
 * @chief-clancy/core
 *
 * Board intelligence, schemas, types, ticket lifecycle, phase pipeline,
 * and shared utilities.
 */
export const PACKAGE_NAME = '@chief-clancy/core' as const;

export type { EnvFileSystem } from './shared/env-parser/index.js';
export { loadClancyEnv, parseEnvContent } from './shared/env-parser/index.js';

export { Cached, CachedMap } from './shared/cache/index.js';

export {
  fetchAndParse,
  pingEndpoint,
  retryFetch,
} from './shared/http/index.js';
export type {
  FetchAndParseOptions,
  PingEndpointOpts,
  RetryOptions,
} from './shared/http/index.js';

export { modifyLabelList, safeLabel } from './shared/label-helpers/index.js';
export type { ModifyLabelListOpts } from './shared/label-helpers/index.js';

export type {
  AzdoRemote,
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
  // Env types
  AzdoEnv,
  BoardConfig,
  GitHubEnv,
  JiraEnv,
  LinearEnv,
  NotionEnv,
  SharedEnv,
  ShortcutEnv,
  // Jira API types
  JiraIssueLabelsResponse,
  JiraIssueLinksResponse,
  JiraSearchResponse,
  JiraTransitionsResponse,
  // GitHub API types
  GitHubComment,
  GitHubCommentsResponse,
  GitHubIssue,
  GitHubIssuesResponse,
  GitHubPr,
  GitHubPrComment,
  GitHubPrComments,
  GitHubPrList,
  GitHubReview,
  GitHubReviewList,
  // Azure DevOps API types
  AzdoProjectResponse,
  AzdoWiqlLinkResponse,
  AzdoWiqlResponse,
  AzdoWorkItem,
  AzdoWorkItemsBatchResponse,
  // Linear API types
  LinearIssueChildrenResponse,
  LinearIssueNode,
  LinearIssueLabelSearchResponse,
  LinearIssueRelationsResponse,
  LinearIssueSearchResponse,
  LinearIssueUpdateResponse,
  LinearIssuesResponse,
  LinearLabelCreateResponse,
  LinearTeamLabelsResponse,
  LinearViewerResponse,
  LinearWorkflowStatesResponse,
  LinearWorkspaceLabelsResponse,
  // Notion API types
  NotionDatabaseQueryResponse,
  NotionMultiSelectOption,
  NotionPage,
  NotionUserResponse,
  // Shortcut API types
  ShortcutEpicStoriesResponse,
  ShortcutLabelCreateResponse,
  ShortcutLabelsResponse,
  ShortcutMemberInfoResponse,
  ShortcutStoryDetailResponse,
  ShortcutStoryNode,
  ShortcutStorySearchResponse,
  ShortcutStoryUpdateResponse,
  ShortcutWorkflowsResponse,
} from './schemas/index.js';
export {
  // Env schemas
  azdoEnvSchema,
  githubEnvSchema,
  jiraEnvSchema,
  linearEnvSchema,
  notionEnvSchema,
  sharedEnvSchema,
  shortcutEnvSchema,
  // Jira API schemas
  jiraIssueLabelsResponseSchema,
  jiraIssueLinksResponseSchema,
  jiraSearchResponseSchema,
  jiraTransitionsResponseSchema,
  // GitHub API schemas
  githubCommentSchema,
  githubCommentsResponseSchema,
  githubIssueSchema,
  githubIssuesResponseSchema,
  githubPrCommentSchema,
  githubPrCommentsSchema,
  githubPrListSchema,
  githubPrSchema,
  githubReviewListSchema,
  githubReviewSchema,
  // Azure DevOps API schemas
  azdoProjectResponseSchema,
  azdoWiqlLinkResponseSchema,
  azdoWiqlResponseSchema,
  azdoWorkItemSchema,
  azdoWorkItemsBatchResponseSchema,
  // Linear API schemas
  linearIssueChildrenResponseSchema,
  linearIssueLabelSearchResponseSchema,
  linearIssueRelationsResponseSchema,
  linearIssueSearchResponseSchema,
  linearIssueUpdateResponseSchema,
  linearIssuesResponseSchema,
  linearLabelCreateResponseSchema,
  linearTeamLabelsResponseSchema,
  linearViewerResponseSchema,
  linearWorkflowStatesResponseSchema,
  linearWorkspaceLabelsResponseSchema,
  // Notion API schemas
  notionDatabaseQueryResponseSchema,
  notionPageSchema,
  notionUserResponseSchema,
  // Shortcut API schemas
  shortcutEpicStoriesResponseSchema,
  shortcutLabelCreateResponseSchema,
  shortcutLabelsResponseSchema,
  shortcutMemberInfoResponseSchema,
  shortcutStoryDetailResponseSchema,
  shortcutStorySearchResponseSchema,
  shortcutStoryUpdateResponseSchema,
  shortcutWorkflowsResponseSchema,
} from './schemas/index.js';

export { createContext, RunContext, runPipeline } from './pipeline/index.js';
export type { PipelineDeps, PipelineResult } from './pipeline/index.js';

// Phase functions + deps types (consumed by terminal dep factory)
export {
  branchSetup,
  cleanupPhase,
  costPhase,
  deliverPhase,
  dryRun,
  epicCompletion,
  feasibilityPhase,
  lockCheck,
  prRetry,
  preflightPhase,
  reworkDetection,
  ticketFetch,
  transition,
} from './pipeline/index.js';
export type {
  BranchSetupDeps,
  CleanupDeps,
  CostPhaseDeps,
  DeliverPhaseDeps,
  EpicCompletionDeps,
  FeasibilityPhaseDeps,
  LockCheckDeps,
  PreflightPhaseDeps,
  PrRetryDeps,
  ReworkDetectionDeps,
  TicketFetchDeps,
  TransitionDeps,
} from './pipeline/index.js';

// Shared utilities (consumed by terminal dep factory for phase wiring)
export type { ExecGit } from './shared/git-ops/index.js';
export {
  checkout,
  currentBranch,
  detectRemote,
  ensureBranch,
  fetchRemoteBranch,
} from './shared/git-ops/index.js';

export type { LockFs } from './shared/lock/index.js';
export {
  deleteLock,
  deleteVerifyAttempt,
  readLock,
  writeLock,
} from './shared/lock/index.js';

export type { ProgressEntry, ProgressFs } from './shared/progress/index.js';
export {
  appendProgress,
  countReworkCycles,
  findEntriesWithStatus,
  formatTimestamp,
  parseProgressFile,
} from './shared/progress/index.js';

export {
  computeTargetBranch,
  computeTicketBranch,
} from './shared/branch/index.js';

export { runPreflight } from './shared/preflight/preflight.js';
export type { PreflightDeps } from './shared/preflight/preflight.js';

export { detectResume, executeResume } from './shared/resume/resume.js';

export { fetchReworkFromPrReview } from './shared/rework/rework.js';
export { postReworkActions } from './shared/rework/rework.js';
export type { PlatformReworkHandlers } from './shared/rework/rework-handlers.js';
export { resolvePlatformHandlers } from './shared/rework/rework-handlers.js';

export { checkFeasibility } from './shared/feasibility/feasibility.js';

export { deliverViaPullRequest } from './shared/deliver-ticket/deliver-ticket.js';

export { deliverEpicToBase } from './shared/deliver-epic/deliver-epic.js';

export { ensureEpicBranch } from './shared/epic/epic.js';

export {
  getQualityData,
  recordDelivery,
  recordRework,
} from './shared/quality/quality.js';
export type { QualityFs } from './shared/quality/quality.js';

export type { FetchFn } from './shared/pr-creation/pr-creation.js';

export type { CostFs } from './shared/cost/cost.js';
export { appendCostEntry } from './shared/cost/cost.js';

export { formatDuration } from './shared/format/format.js';

export { detectBoard, sharedEnv } from './board/index.js';
export { createBoard } from './board/factory/index.js';

export {
  createGitHubBoard,
  fetchBlockerStatus as fetchGitHubBlockerStatus,
  fetchChildrenStatus as fetchGitHubChildrenStatus,
} from './board/github/index.js';

export {
  createJiraBoard,
  fetchBlockerStatus as fetchJiraBlockerStatus,
  fetchChildrenStatus as fetchJiraChildrenStatus,
} from './board/jira/index.js';

export {
  createLinearBoard,
  fetchBlockerStatus as fetchLinearBlockerStatus,
  fetchChildrenStatus as fetchLinearChildrenStatus,
} from './board/linear/index.js';

export {
  createShortcutBoard,
  fetchBlockerStatus as fetchShortcutBlockerStatus,
  fetchChildrenStatus as fetchShortcutChildrenStatus,
} from './board/shortcut/index.js';

export {
  createAzdoBoard,
  fetchBlockerStatus as fetchAzdoBlockerStatus,
  fetchChildrenStatus as fetchAzdoChildrenStatus,
} from './board/azdo/index.js';

export {
  createNotionBoard,
  fetchBlockerStatus as fetchNotionBlockerStatus,
  fetchChildrenStatus as fetchNotionChildrenStatus,
} from './board/notion/index.js';
