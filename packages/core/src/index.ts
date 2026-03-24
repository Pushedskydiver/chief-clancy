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

export { detectBoard, sharedEnv } from './board/index.js';
export { createBoard } from './board/factory/index.js';

export { createGitHubBoard } from './board/github/index.js';
export {
  GITHUB_API,
  closeIssue,
  fetchIssues as fetchGitHubIssues,
  githubHeaders,
  isValidRepo,
  pingGitHub,
  resolveUsername,
} from './board/github/index.js';
export {
  fetchBlockerStatus as fetchGitHubBlockerStatus,
  fetchChildrenStatus as fetchGitHubChildrenStatus,
  parseBlockerRefs,
  parseEpicRef,
} from './board/github/index.js';

export { createJiraBoard } from './board/jira/index.js';
export {
  buildAuthHeader,
  buildJql,
  extractAdfText,
  fetchTickets as fetchJiraTickets,
  isSafeJqlValue,
  isValidIssueKey,
  jiraHeaders,
  lookupTransitionId as lookupJiraTransitionId,
  pingJira,
  transitionIssue as transitionJiraIssue,
} from './board/jira/index.js';
export {
  fetchBlockerStatus as fetchJiraBlockerStatus,
  fetchChildrenStatus as fetchJiraChildrenStatus,
} from './board/jira/index.js';

export { createLinearBoard } from './board/linear/index.js';
export {
  fetchIssues as fetchLinearIssues,
  isValidTeamId,
  LINEAR_API,
  linearGraphql,
  linearHeaders,
  pingLinear,
} from './board/linear/index.js';
export {
  fetchBlockerStatus as fetchLinearBlockerStatus,
  fetchChildrenStatus as fetchLinearChildrenStatus,
  lookupWorkflowStateId,
  transitionIssue as transitionLinearIssue,
} from './board/linear/index.js';

export { createShortcutBoard } from './board/shortcut/index.js';
export {
  fetchStories as fetchShortcutStories,
  fetchWorkflows,
  pingShortcut,
  resolveDoneStateIds,
  resolveWorkflowStateId,
  resolveWorkflowStateIdsByType,
  SHORTCUT_API,
  shortcutHeaders,
  transitionStory,
} from './board/shortcut/index.js';
export {
  fetchBlockerStatus as fetchShortcutBlockerStatus,
  fetchChildrenStatus as fetchShortcutChildrenStatus,
} from './board/shortcut/index.js';

export { createAzdoBoard } from './board/azdo/index.js';
export {
  apiBase as azdoApiBase,
  azdoHeaders,
  azdoPatchHeaders,
  AZDO_API_VERSION,
  buildAzdoAuth,
  buildTagsString as azdoBuildTagsString,
  extractIdFromRelationUrl as azdoExtractIdFromRelationUrl,
  fetchTickets as fetchAzdoTickets,
  fetchWorkItem as fetchAzdoWorkItem,
  fetchWorkItems as fetchAzdoWorkItems,
  isSafeWiqlValue,
  parseWorkItemId,
  parseTags as azdoParseTags,
  pingAzdo,
  runWiql,
  updateWorkItem as updateAzdoWorkItem,
  workItemToTicket as azdoWorkItemToTicket,
} from './board/azdo/index.js';
export {
  fetchBlockerStatus as fetchAzdoBlockerStatus,
  fetchChildrenStatus as fetchAzdoChildrenStatus,
} from './board/azdo/index.js';

export { createNotionBoard } from './board/notion/index.js';
export {
  fetchPage as fetchNotionPage,
  findPageByKey as findNotionPageByKey,
  getArrayProperty as getNotionArrayProperty,
  getDescriptionText as getNotionDescriptionText,
  getPageStatus as getNotionPageStatus,
  getPageTitle as getNotionPageTitle,
  getStringProperty as getNotionStringProperty,
  isCompleteStatus as isNotionCompleteStatus,
  isPageIncomplete as isNotionPageIncomplete,
  NOTION_API,
  notionHeaders,
  NOTION_VERSION,
  pingNotion,
  queryAllPages as queryAllNotionPages,
  queryDatabase as queryNotionDatabase,
  updatePage as updateNotionPage,
} from './board/notion/index.js';
export {
  fetchBlockerStatus as fetchNotionBlockerStatus,
  fetchChildrenStatus as fetchNotionChildrenStatus,
} from './board/notion/index.js';
