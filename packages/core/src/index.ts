/**
 * @chief-clancy/core
 *
 * Board integrations, schemas, types, and shared utilities.
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

// Shared utilities (consumed by terminal dep factory for phase wiring)
export type { ExecGit } from './shared/git-ops/index.js';
export {
  checkout,
  currentBranch,
  detectRemote,
  ensureBranch,
  fetchRemoteBranch,
} from './shared/git-ops/index.js';

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
