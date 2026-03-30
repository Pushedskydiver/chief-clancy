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
  Fetcher,
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
  JiraProjectPing,
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
  GitHubRepoPing,
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
  jiraProjectPingSchema,
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
  githubRepoPingSchema,
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

export {
  createContext,
  RunContext,
  runPipeline,
} from './dev/pipeline/index.js';
export type { PipelineDeps, PipelineResult } from './dev/pipeline/index.js';

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
} from './dev/pipeline/index.js';
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
} from './dev/pipeline/index.js';

// Shared utilities (consumed by terminal dep factory for phase wiring)
export type { ExecGit } from './shared/git-ops/index.js';
export {
  checkout,
  currentBranch,
  detectRemote,
  ensureBranch,
  fetchRemoteBranch,
} from './shared/git-ops/index.js';

export type { LockFs } from './dev/lifecycle/lock/index.js';
export {
  deleteLock,
  deleteVerifyAttempt,
  readLock,
  writeLock,
} from './dev/lifecycle/lock/index.js';

export type {
  ProgressEntry,
  ProgressFs,
} from './dev/lifecycle/progress/index.js';
export {
  appendProgress,
  countReworkCycles,
  findEntriesWithStatus,
  formatTimestamp,
  parseProgressFile,
} from './dev/lifecycle/progress/index.js';

export {
  computeTargetBranch,
  computeTicketBranch,
} from './dev/lifecycle/branch/index.js';

export { runPreflight } from './dev/lifecycle/preflight/preflight.js';
export type { PreflightDeps } from './dev/lifecycle/preflight/preflight.js';

export { detectResume, executeResume } from './dev/lifecycle/resume/resume.js';

export { fetchReworkFromPrReview } from './dev/lifecycle/rework/rework.js';
export { postReworkActions } from './dev/lifecycle/rework/rework.js';
export type { PlatformReworkHandlers } from './dev/lifecycle/rework/rework-handlers.js';
export { resolvePlatformHandlers } from './dev/lifecycle/rework/rework-handlers.js';

export { checkFeasibility } from './dev/lifecycle/feasibility/feasibility.js';

export { deliverViaPullRequest } from './dev/lifecycle/deliver-ticket/deliver-ticket.js';

export { deliverEpicToBase } from './dev/lifecycle/deliver-epic/deliver-epic.js';

export { ensureEpicBranch } from './dev/lifecycle/epic/epic.js';

export {
  getQualityData,
  recordDelivery,
  recordRework,
} from './dev/lifecycle/quality/quality.js';
export type { QualityFs } from './dev/lifecycle/quality/quality.js';

export type { FetchFn } from './dev/lifecycle/pr-creation/pr-creation.js';
export { attemptPrCreation } from './dev/lifecycle/pr-creation/pr-creation.js';
export { resolveCommitType } from './dev/lifecycle/commit-type/commit-type.js';
export { buildPrBody } from './dev/lifecycle/pull-request/pr-body/pr-body.js';

export type { CostFs } from './dev/lifecycle/cost/cost.js';
export { appendCostEntry } from './dev/lifecycle/cost/cost.js';

export { formatDuration } from './dev/lifecycle/format/format.js';

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
