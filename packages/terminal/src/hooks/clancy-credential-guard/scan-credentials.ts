/**
 * Credential scanning logic for the credential-guard hook.
 *
 * Scans file content written by Write, Edit, and MultiEdit tools for
 * known credential patterns. Whitelisted paths (e.g. `.env.example`)
 * are excluded from scanning.
 */

/** A named regex pattern for a credential type. */
type CredentialPattern = {
  readonly name: string;
  readonly regex: RegExp;
};

/** Build an assignment pattern: `label [:=] "value{min,}"`. */
function assignment(label: string, value: string, min: number): RegExp {
  return new RegExp(`(?:${label})\\s*[:=]\\s*["']?${value}{${min},}["']?`, 'i');
}

const ALNUM = '[A-Za-z0-9\\-_.]';
const ALNUM_PLUS = '[A-Za-z0-9+/=]';
const ALNUM_SLASH = '[A-Za-z0-9/+=]';

/** Credential patterns to scan for in file content. */
const CREDENTIAL_PATTERNS: readonly CredentialPattern[] = [
  // Generic assignment patterns
  {
    name: 'Generic API key',
    regex: assignment('api[_-]?key|apikey', ALNUM, 20),
  },
  {
    name: 'Generic secret',
    regex: assignment('secret|private[_-]?key', ALNUM, 20),
  },
  {
    name: 'Generic token',
    regex: assignment('auth[_-]?token|access[_-]?token|bearer', ALNUM, 20),
  },
  {
    name: 'Generic password',
    regex: assignment('password|passwd|pwd', '[^\\s"\']', 8),
  },
  {
    name: 'AWS Secret Key',
    regex: assignment('aws_secret_access_key|aws_secret', ALNUM_SLASH, 40),
  },
  {
    name: 'Atlassian API token',
    regex: assignment('jira_api_token|atlassian[_-]?token', ALNUM_PLUS, 24),
  },

  // Prefix-based token patterns
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub PAT (classic)', regex: /ghp_[A-Za-z0-9]{36}/ },
  { name: 'GitHub PAT (fine-grained)', regex: /github_pat_[A-Za-z0-9_]{82}/ },
  { name: 'GitHub OAuth token', regex: /gho_[A-Za-z0-9]{36}/ },
  { name: 'Slack token', regex: /xox[bpors]-[0-9]{10,}-[A-Za-z0-9-]+/ },
  { name: 'Stripe key', regex: /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}/ },
  { name: 'Linear API key', regex: /lin_api_[A-Za-z0-9]{40,}/ },

  // Structural patterns
  {
    name: 'Private key',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: 'Database connection string',
    regex: /(?:mongodb|postgres|mysql|redis):\/\/[^\s"']+:[^\s"']+@/i,
  },
];

/** File paths that are allowed to contain credential-like patterns. */
const ALLOWED_PATHS: readonly string[] = [
  '.clancy/.env',
  '.env.local',
  '.env.example',
  '.env.development',
  '.env.test',
];

/**
 * Check whether a file path is in the allow list.
 *
 * @param filePath - The absolute or relative file path.
 * @returns `true` if the path ends with an allowed suffix.
 */
export function isAllowedPath(filePath: string): boolean {
  return ALLOWED_PATHS.some((allowed) => filePath.endsWith(allowed));
}

/**
 * Scan content for known credential patterns.
 *
 * @param content - The file content to scan.
 * @returns An array of matched credential type names (empty if clean).
 */
export function scanForCredentials(content: string): readonly string[] {
  if (!content) return [];

  return CREDENTIAL_PATTERNS.filter(({ regex }) => regex.test(content)).map(
    ({ name }) => name,
  );
}

/** Extract the `new_string` field from an unknown edit entry. */
function extractNewString(entry: unknown): string | undefined {
  // Narrowed to non-null object before accessing .new_string
  const isObject = typeof entry === 'object' && entry !== null;

  if (!isObject) return undefined;

  const value = (entry as Record<string, unknown>).new_string;

  return typeof value === 'string' ? value : undefined;
}

/**
 * Extract scannable content from a tool input based on tool type.
 *
 * @param toolName - The Claude Code tool name (`Write`, `Edit`, `MultiEdit`).
 * @param toolInput - The raw tool input object.
 * @returns The content string to scan, or `null` if not applicable.
 */
export function extractContent(
  toolName: string,
  toolInput: Record<string, unknown>,
): string | null {
  if (toolName === 'Write') {
    const content = toolInput.content;

    return typeof content === 'string' ? content : null;
  }

  if (toolName === 'Edit') {
    const newString = toolInput.new_string;

    return typeof newString === 'string' ? newString : null;
  }

  if (toolName === 'MultiEdit') {
    const edits = toolInput.edits;

    if (!Array.isArray(edits)) return null;

    const strings = edits.map(extractNewString).filter(Boolean);

    return strings.join('\n');
  }

  return null;
}
