/**
 * @chief-clancy/core
 *
 * Board integrations, schemas, types, and shared utilities.
 */
export const PACKAGE_NAME = '@chief-clancy/core' as const;

export type { EnvFileSystem } from './shared/env-parser.js';
export { loadClancyEnv, parseEnvContent } from './shared/env-parser.js';

export { Cached, CachedMap } from './shared/cache.js';

export { fetchAndParse } from './shared/http/fetch-and-parse.js';
export type {
  FetchAndParseOptions,
  Fetcher,
} from './shared/http/fetch-and-parse.js';
export { pingEndpoint } from './shared/http/ping-endpoint.js';
export type { PingEndpointOpts } from './shared/http/ping-endpoint.js';
export { retryFetch } from './shared/http/retry-fetch.js';
export type { RetryOptions } from './shared/http/retry-fetch.js';

export { modifyLabelList, safeLabel } from './shared/label-helpers.js';
export type { ModifyLabelListOpts } from './shared/label-helpers.js';

export type {
  Board,
  BoardProvider,
  ChildrenStatus,
  FetchedTicket,
  FetchTicketOpts,
  PingResult,
  Ticket,
} from './types/board.js';
export type {
  AzdoRemote,
  BitbucketRemote,
  BitbucketServerRemote,
  GenericRemote,
  GitHubRemote,
  GitLabRemote,
  GitPlatform,
  NoRemote,
  PrCreationFailure,
  PrCreationResult,
  PrCreationSuccess,
  PrReviewState,
  RemoteInfo,
} from './types/remote.js';
export type { ProgressStatus } from './types/progress.js';
export {
  COMPLETED_STATUSES,
  DELIVERED_STATUSES,
  FAILED_STATUSES,
} from './types/progress.js';

export type {
  AzdoEnv,
  BoardConfig,
  GitHubEnv,
  JiraEnv,
  LinearEnv,
  NotionEnv,
  SharedEnv,
  ShortcutEnv,
} from './schemas/env.js';
export {
  azdoEnvSchema,
  githubEnvSchema,
  jiraEnvSchema,
  linearEnvSchema,
  notionEnvSchema,
  sharedEnvSchema,
  shortcutEnvSchema,
} from './schemas/env.js';

export type {
  AzdoProjectResponse,
  AzdoWiqlLinkResponse,
  AzdoWiqlResponse,
  AzdoWorkItem,
  AzdoWorkItemsBatchResponse,
} from './schemas/azdo/azdo.js';
export {
  azdoProjectResponseSchema,
  azdoWiqlLinkResponseSchema,
  azdoWiqlResponseSchema,
  azdoWorkItemSchema,
  azdoWorkItemsBatchResponseSchema,
} from './schemas/azdo/azdo.js';

export type {
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
} from './schemas/github.js';
export {
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
} from './schemas/github.js';

export type {
  JiraIssueLabelsResponse,
  JiraIssueLinksResponse,
  JiraProjectPing,
  JiraSearchResponse,
  JiraTransitionsResponse,
} from './schemas/jira.js';
export {
  jiraIssueLabelsResponseSchema,
  jiraIssueLinksResponseSchema,
  jiraProjectPingSchema,
  jiraSearchResponseSchema,
  jiraTransitionsResponseSchema,
} from './schemas/jira.js';

export type {
  LinearIssueChildrenResponse,
  LinearIssueLabelSearchResponse,
  LinearIssueNode,
  LinearIssueRelationsResponse,
  LinearIssueSearchResponse,
  LinearIssueUpdateResponse,
  LinearIssuesResponse,
  LinearLabelCreateResponse,
  LinearTeamLabelsResponse,
  LinearViewerResponse,
  LinearWorkflowStatesResponse,
  LinearWorkspaceLabelsResponse,
} from './schemas/linear.js';
export {
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
} from './schemas/linear.js';

export type {
  NotionDatabaseQueryResponse,
  NotionMultiSelectOption,
  NotionPage,
  NotionUserResponse,
} from './schemas/notion.js';
export {
  notionDatabaseQueryResponseSchema,
  notionPageSchema,
  notionUserResponseSchema,
} from './schemas/notion.js';

export type {
  ShortcutEpicStoriesResponse,
  ShortcutLabelCreateResponse,
  ShortcutLabelsResponse,
  ShortcutMemberInfoResponse,
  ShortcutStoryDetailResponse,
  ShortcutStoryNode,
  ShortcutStorySearchResponse,
  ShortcutStoryUpdateResponse,
  ShortcutWorkflowsResponse,
} from './schemas/shortcut.js';
export {
  shortcutEpicStoriesResponseSchema,
  shortcutLabelCreateResponseSchema,
  shortcutLabelsResponseSchema,
  shortcutMemberInfoResponseSchema,
  shortcutStoryDetailResponseSchema,
  shortcutStorySearchResponseSchema,
  shortcutStoryUpdateResponseSchema,
  shortcutWorkflowsResponseSchema,
} from './schemas/shortcut.js';

// Shared utilities (consumed by terminal dep factory for phase wiring)
export type { ExecGit } from './shared/git-ops.js';
export {
  checkout,
  currentBranch,
  detectRemote,
  ensureBranch,
  fetchRemoteBranch,
} from './shared/git-ops.js';

export { detectBoard, sharedEnv } from './board/detect-board.js';
export { createBoard } from './board/factory.js';

export { createGitHubBoard } from './board/github/github-board.js';
export {
  fetchBlockerStatus as fetchGitHubBlockerStatus,
  fetchChildrenStatus as fetchGitHubChildrenStatus,
} from './board/github/relations.js';

export { createJiraBoard } from './board/jira/jira-board.js';
export {
  fetchBlockerStatus as fetchJiraBlockerStatus,
  fetchChildrenStatus as fetchJiraChildrenStatus,
} from './board/jira/relations.js';

export { createLinearBoard } from './board/linear/linear-board.js';
export {
  fetchBlockerStatus as fetchLinearBlockerStatus,
  fetchChildrenStatus as fetchLinearChildrenStatus,
} from './board/linear/relations.js';

export { createShortcutBoard } from './board/shortcut/shortcut-board.js';
export {
  fetchBlockerStatus as fetchShortcutBlockerStatus,
  fetchChildrenStatus as fetchShortcutChildrenStatus,
} from './board/shortcut/relations.js';

export { createAzdoBoard } from './board/azdo/azdo-board.js';
export {
  fetchBlockerStatus as fetchAzdoBlockerStatus,
  fetchChildrenStatus as fetchAzdoChildrenStatus,
} from './board/azdo/relations.js';

export { createNotionBoard } from './board/notion/notion-board.js';
export {
  fetchBlockerStatus as fetchNotionBlockerStatus,
  fetchChildrenStatus as fetchNotionChildrenStatus,
} from './board/notion/relations.js';
