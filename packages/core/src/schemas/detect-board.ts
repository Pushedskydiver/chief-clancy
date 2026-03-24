/**
 * Board detection from raw `.clancy/.env` key-value pairs.
 *
 * Checks env vars in priority order and validates against the
 * board-specific schema. Returns a `BoardConfig` on success or
 * an error string on failure.
 */
import type { BoardConfig, SharedEnv } from './env.js';

import {
  azdoEnvSchema,
  githubEnvSchema,
  jiraEnvSchema,
  linearEnvSchema,
  notionEnvSchema,
  shortcutEnvSchema,
} from './env.js';

/**
 * Structural type for zod/mini schemas — intentional type erasure.
 *
 * Each board schema has a different shape (`ZodMiniObject<...>`), so there is
 * no common base type exported from `zod/mini`. We erase to `Record<string, unknown>`
 * here to keep the probes array simple. The `as BoardConfig` cast in `detectBoard`
 * is the consequence — safe because each probe pairs a literal provider with the
 * schema that produces that provider's env type.
 */
type SafeParseable = {
  readonly safeParse: (
    data: unknown,
  ) =>
    | { readonly success: true; readonly data: Record<string, unknown> }
    | { readonly success: false; readonly error: { readonly message: string } };
};

type BoardProbe = {
  readonly provider: BoardConfig['provider'];
  readonly label: string;
  readonly detect: (raw: Record<string, string>) => boolean;
  readonly schema: SafeParseable;
};

/**
 * Board probes in priority order.
 *
 * GitHub requires both `GITHUB_TOKEN` and `GITHUB_REPO` to avoid
 * false positives when `GITHUB_TOKEN` is used as a git host token
 * for other boards.
 */
const probes: readonly BoardProbe[] = [
  {
    provider: 'jira',
    label: 'Jira',
    detect: (raw) => Boolean(raw.JIRA_BASE_URL),
    schema: jiraEnvSchema,
  },
  {
    provider: 'github',
    label: 'GitHub',
    detect: (raw) => Boolean(raw.GITHUB_TOKEN && raw.GITHUB_REPO),
    schema: githubEnvSchema,
  },
  {
    provider: 'linear',
    label: 'Linear',
    detect: (raw) => Boolean(raw.LINEAR_API_KEY),
    schema: linearEnvSchema,
  },
  {
    provider: 'shortcut',
    label: 'Shortcut',
    detect: (raw) => Boolean(raw.SHORTCUT_API_TOKEN),
    schema: shortcutEnvSchema,
  },
  {
    provider: 'notion',
    label: 'Notion',
    detect: (raw) => Boolean(raw.NOTION_DATABASE_ID),
    schema: notionEnvSchema,
  },
  {
    provider: 'azdo',
    label: 'Azure DevOps',
    detect: (raw) => Boolean(raw.AZDO_ORG),
    schema: azdoEnvSchema,
  },
];

/**
 * Detect which board provider is configured from raw env vars.
 *
 * Detection priority: Jira → GitHub → Linear → Shortcut → Notion → Azure DevOps.
 *
 * @param raw - Key-value pairs from the `.clancy/.env` file.
 * @returns A validated `BoardConfig` on success, or an error string on failure.
 */
export function detectBoard(raw: Record<string, string>): BoardConfig | string {
  const matched = probes.find((probe) => probe.detect(raw));

  if (!matched) {
    return '✗ No board detected — set Jira, GitHub, Linear, Shortcut, Notion, or Azure DevOps credentials in .clancy/.env';
  }

  const parsed = matched.schema.safeParse(raw);
  if (!parsed.success) {
    return `✗ ${matched.label} env validation failed: ${parsed.error.message}`;
  }

  // Safe: each probe pairs a literal provider with the schema that produces
  // that provider's env type. See SafeParseable comment for why erasure is needed.
  return { provider: matched.provider, env: parsed.data } as BoardConfig;
}

/**
 * Type-safe accessor for shared env vars from any board config.
 *
 * Returns the full env object typed as `SharedEnv`. Board-specific fields
 * are still present at runtime but not visible in the type.
 *
 * @param config - A validated board configuration from `detectBoard`.
 * @returns The shared env fields common to all board providers.
 */
export function sharedEnv(config: BoardConfig): SharedEnv {
  return config.env;
}
