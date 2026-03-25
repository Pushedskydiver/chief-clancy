/**
 * Remote git hosting types shared across remote detection and PR creation.
 */

/** Supported git hosting platforms. */
export type GitPlatform =
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'bitbucket-server'
  | 'azure'
  | 'unknown'
  | 'none';

/** GitHub remote info. */
export type GitHubRemote = {
  readonly host: 'github';
  readonly owner: string;
  readonly repo: string;
  readonly hostname: string;
};

/** GitLab remote info. */
export type GitLabRemote = {
  readonly host: 'gitlab';
  readonly projectPath: string;
  readonly hostname: string;
};

/** Bitbucket Cloud remote info. */
export type BitbucketRemote = {
  readonly host: 'bitbucket';
  readonly workspace: string;
  readonly repoSlug: string;
  readonly hostname: string;
};

/** Bitbucket Server remote info. */
export type BitbucketServerRemote = {
  readonly host: 'bitbucket-server';
  readonly projectKey: string;
  readonly repoSlug: string;
  readonly hostname: string;
};

/** Azure DevOps remote info. */
export type AzdoRemote = {
  readonly host: 'azure';
  readonly org: string;
  readonly project: string;
  readonly repo: string;
  readonly hostname: string;
};

/** Unknown remote info. */
export type GenericRemote = {
  readonly host: 'unknown';
  readonly url: string;
};

/** No remote detected. */
export type NoRemote = {
  readonly host: 'none';
};

/** Parsed remote URL with platform and path info. */
export type RemoteInfo =
  | GitHubRemote
  | GitLabRemote
  | BitbucketRemote
  | BitbucketServerRemote
  | AzdoRemote
  | GenericRemote
  | NoRemote;

/** Successful PR/MR creation. */
export type PrCreationSuccess = {
  readonly ok: true;
  readonly url: string;
  readonly number: number;
};

/** Failed PR/MR creation. */
export type PrCreationFailure = {
  readonly ok: false;
  readonly error: string;
  readonly alreadyExists?: boolean;
};

/** Result of a PR/MR creation attempt. */
export type PrCreationResult = PrCreationSuccess | PrCreationFailure;

/** Result of checking PR/MR review state. */
export type PrReviewState = {
  /** Whether changes have been requested by a reviewer. */
  readonly changesRequested: boolean;
  /** The PR/MR number/ID (needed to fetch comments). */
  readonly prNumber: number;
  /** The PR/MR URL (for logging). */
  readonly prUrl: string;
  /** Usernames of reviewers who requested changes (GitHub only). */
  readonly reviewers?: readonly string[];
};
