/**
 * Remote git host detection — pure parsing functions.
 *
 * Parses git remote URLs to detect the hosting platform (GitHub, GitLab,
 * Bitbucket, etc.) and extract owner/repo/project info. No I/O — the
 * actual `git remote get-url` shell-out lives in `git-ops/`.
 */
import type { GitPlatform, RemoteInfo } from '~/c/types/index.js';

/**
 * Extract hostname and path from a raw git remote URL.
 *
 * Strips `.git` suffix, then tries SSH (`git@host:path`) and
 * HTTPS/SSH-URL (`https://host/path`, `ssh://git@host/path`) formats.
 */
function extractHostAndPath(
  rawUrl: string,
): { readonly hostname: string; readonly path: string } | undefined {
  const url = rawUrl.trim().replace(/\.git$/, '');

  // SSH format: git@<host>:<path>
  const sshMatch = url.match(/^git@([^:]+):(.+)$/);

  // HTTPS or SSH-URL format: https://<host>/<path> or ssh://git@<host>/<path>
  const httpsMatch = url.match(
    /^(?:https?|ssh):\/\/(?:[^@]+@)?([^/:]+)(?::\d+)?\/(.+)$/,
  );

  const hostname = sshMatch?.[1] ?? httpsMatch?.[1];
  const path = sshMatch?.[2] ?? httpsMatch?.[2];

  if (!hostname || !path) return undefined;

  return { hostname, path };
}

/** Parse Bitbucket Server `/scm/<projectKey>/<repo>` path format. */
function parseBitbucketServerPath(
  path: string,
  hostname: string,
): RemoteInfo | undefined {
  const scmMatch = path.match(/^scm\/([^/]+)\/(.+)$/);
  if (!scmMatch) return undefined;

  return {
    host: 'bitbucket-server',
    projectKey: scmMatch[1],
    repoSlug: scmMatch[2],
    hostname,
  };
}

/** Options for {@link buildRemoteInfo}. */
type BuildRemoteInfoOpts = {
  readonly platform: GitPlatform;
  readonly hostname: string;
  readonly path: string;
  readonly rawUrl: string;
};

/** Parse a Bitbucket path into Cloud or Server remote info. */
function parseBitbucketPath(
  opts: Pick<BuildRemoteInfoOpts, 'hostname' | 'path' | 'rawUrl'>,
  host: 'bitbucket' | 'bitbucket-server',
): RemoteInfo {
  const serverInfo = parseBitbucketServerPath(opts.path, opts.hostname);
  if (serverInfo) return serverInfo;

  const parts = opts.path.split('/');
  if (parts.length < 2) return { host: 'unknown', url: opts.rawUrl };

  return host === 'bitbucket'
    ? {
        host: 'bitbucket',
        workspace: parts[0],
        repoSlug: parts[1],
        hostname: opts.hostname,
      }
    : {
        host: 'bitbucket-server',
        projectKey: parts[0],
        repoSlug: parts[1],
        hostname: opts.hostname,
      };
}

/**
 * Build a {@link RemoteInfo} from a known platform, hostname, and path.
 *
 * Centralises the platform-specific path extraction.
 */
function buildRemoteInfo(opts: BuildRemoteInfoOpts): RemoteInfo {
  const { platform, hostname, path, rawUrl } = opts;

  switch (platform) {
    case 'github': {
      const parts = path.split('/');
      if (parts.length >= 2) {
        return { host: 'github', owner: parts[0], repo: parts[1], hostname };
      }
      return { host: 'unknown', url: rawUrl };
    }

    case 'gitlab':
      return { host: 'gitlab', projectPath: path, hostname };

    case 'bitbucket':
      return parseBitbucketPath(opts, 'bitbucket');

    case 'bitbucket-server':
      return parseBitbucketPath(opts, 'bitbucket-server');

    case 'azure':
      return { host: 'azure', url: rawUrl };

    case 'unknown':
    case 'none':
    default:
      return { host: 'unknown', url: rawUrl };
  }
}

/**
 * Parse a git remote URL into platform-specific info.
 *
 * Supports HTTPS, SSH, and SSH-URL formats for GitHub, GitLab, Bitbucket
 * (Cloud and Server), Azure DevOps, and self-hosted instances.
 *
 * @param rawUrl - The raw git remote URL.
 * @returns Parsed remote info with platform and path details.
 */
export function parseRemote(rawUrl: string): RemoteInfo {
  const extracted = extractHostAndPath(rawUrl);

  if (!extracted) return { host: 'unknown', url: rawUrl };

  const { hostname, path } = extracted;
  const platform = detectPlatformFromHostname(hostname);

  return buildRemoteInfo({ platform, hostname, path, rawUrl });
}

/**
 * Detect the git hosting platform from a hostname.
 *
 * Uses known domain patterns. Self-hosted instances with custom domains
 * (e.g. `git.acme.com`) fall through to `'unknown'` — use
 * `CLANCY_GIT_PLATFORM` env var to override.
 *
 * @param hostname - The hostname from the remote URL.
 * @returns The detected platform.
 */
export function detectPlatformFromHostname(hostname: string): GitPlatform {
  const lower = hostname.toLowerCase();

  if (lower === 'github.com' || lower.includes('github')) return 'github';
  if (lower === 'gitlab.com' || lower.includes('gitlab')) return 'gitlab';
  if (lower === 'bitbucket.org' || lower.includes('bitbucket'))
    return 'bitbucket';
  if (lower.includes('dev.azure') || lower.includes('visualstudio'))
    return 'azure';

  return 'unknown';
}

/**
 * Build the API base URL for a given remote.
 *
 * @param remote - The parsed remote info.
 * @param apiUrlOverride - Override from `CLANCY_GIT_API_URL` env var.
 * @returns The API base URL, or `undefined` if not applicable.
 */
export function buildApiBaseUrl(
  remote: RemoteInfo,
  apiUrlOverride?: string,
): string | undefined {
  if (apiUrlOverride) return apiUrlOverride.replace(/\/$/, '');

  switch (remote.host) {
    case 'github':
      return remote.hostname === 'github.com'
        ? 'https://api.github.com'
        : `https://${remote.hostname}/api/v3`;
    case 'gitlab':
      return `https://${remote.hostname}/api/v4`;
    case 'bitbucket':
      return 'https://api.bitbucket.org/2.0';
    case 'bitbucket-server':
      return `https://${remote.hostname}/rest/api/1.0`;
    case 'none':
    case 'unknown':
    case 'azure':
      return undefined;
  }
}
