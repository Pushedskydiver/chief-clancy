/**
 * Hook installer for Claude Code settings.
 *
 * Copies compiled hook scripts into the Claude config directory and
 * registers them in `settings.json` without clobbering existing config.
 * All internal logic is immutable — settings are built as new objects,
 * never mutated in place.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** A command hook entry in Claude's settings.json. */
type CommandHook = { readonly type: 'command'; readonly command: string };

/** An agent hook entry in Claude's settings.json. */
type AgentHook = {
  readonly type: 'agent';
  readonly prompt: string;
  readonly timeout: number;
};

/** A single hook entry in Claude's settings.json. */
type HookEntry = { readonly hooks: readonly (CommandHook | AgentHook)[] };

/** A record of event names to their hook entries. */
type HookRegistrations = Record<string, readonly HookEntry[]>;

/** Options for the hook installer. */
type HookInstallerOptions = {
  readonly claudeConfigDir: string;
  readonly hooksSourceDir: string;
  readonly verificationGatePrompt?: string;
};

/** Compiled hook files Clancy ships. */
const HOOK_FILES = [
  'clancy-check-update.js',
  'clancy-statusline.js',
  'clancy-context-monitor.js',
  'clancy-credential-guard.js',
  'clancy-branch-guard.js',
  'clancy-post-compact.js',
  'clancy-notification.js',
  'clancy-drift-detector.js',
] as const;

/** Build a `node "path"` command string for a hook file. */
function buildNodeCommand(hooksDir: string, fileName: string): string {
  return `node ${JSON.stringify(join(hooksDir, fileName))}`;
}

/** Wrap a command string in a single-hook entry. */
function commandEntry(command: string): HookEntry {
  return { hooks: [{ type: 'command', command }] };
}

/** Wrap an agent prompt in a single-hook entry. */
function agentEntry(prompt: string, timeout: number): HookEntry {
  return { hooks: [{ type: 'agent', prompt, timeout }] };
}

/** Check whether an event's entries already contain a given command. */
function hasCommand(entries: readonly HookEntry[], command: string): boolean {
  return entries.some((e) =>
    e.hooks.some((h) => h.type === 'command' && h.command === command),
  );
}

/** Check whether an event's entries already contain a matching agent prompt. */
function hasAgentPrompt(
  entries: readonly HookEntry[],
  prompt: string,
): boolean {
  const fingerprint = prompt.slice(0, 100);

  return entries.some((e) =>
    e.hooks.some(
      (h) =>
        h.type === 'agent' &&
        'prompt' in h &&
        h.prompt.slice(0, 100) === fingerprint,
    ),
  );
}

/**
 * Build the desired hook registrations for a given hooks directory.
 *
 * Returns a pure data structure mapping event names to hook entries.
 * No deduplication — that happens during merge.
 *
 * @param hooksDir - The installed hooks directory path.
 * @param verificationGatePrompt - Optional agent prompt for the Stop hook.
 * @returns A record of event names to their desired hook entries.
 */
function buildDesiredHooks(
  hooksDir: string,
  verificationGatePrompt?: string,
): HookRegistrations {
  const cmd = (fileName: string): string =>
    buildNodeCommand(hooksDir, fileName);

  const base: HookRegistrations = {
    SessionStart: [commandEntry(cmd('clancy-check-update.js'))],
    PostToolUse: [
      commandEntry(cmd('clancy-context-monitor.js')),
      commandEntry(cmd('clancy-drift-detector.js')),
    ],
    PreToolUse: [
      commandEntry(cmd('clancy-credential-guard.js')),
      commandEntry(cmd('clancy-branch-guard.js')),
    ],
    PostCompact: [commandEntry(cmd('clancy-post-compact.js'))],
    Notification: [commandEntry(cmd('clancy-notification.js'))],
  };

  if (!verificationGatePrompt) return base;

  return { ...base, Stop: [agentEntry(verificationGatePrompt, 120)] };
}

/** Filter out desired entries that are already registered in existing. */
function filterNewEntries(
  existing: readonly HookEntry[],
  desired: readonly HookEntry[],
): readonly HookEntry[] {
  return desired.filter((entry) => {
    const hook = entry.hooks[0];

    if (hook.type === 'command') return !hasCommand(existing, hook.command);

    return !hasAgentPrompt(existing, hook.prompt);
  });
}

/** Merge desired entries into existing for a single event, deduplicating. */
function mergeEventEntries(
  existing: readonly HookEntry[],
  desired: readonly HookEntry[],
): readonly HookEntry[] {
  const newEntries = filterNewEntries(existing, desired);

  return [...existing, ...newEntries];
}

/**
 * Merge desired hook registrations into existing ones, deduplicating.
 *
 * @param existing - The current hook registrations from settings.json.
 * @param desired - The hook registrations to add.
 * @returns A new merged registrations record.
 */
function mergeHookRegistrations(
  existing: HookRegistrations,
  desired: HookRegistrations,
): HookRegistrations {
  const allEvents = [
    ...new Set([...Object.keys(existing), ...Object.keys(desired)]),
  ];

  const entries = allEvents.map((event) => {
    const merged = mergeEventEntries(
      existing[event] ?? [],
      desired[event] ?? [],
    );

    return [event, merged] as const;
  });

  return Object.fromEntries(entries);
}

/**
 * Merge hook registrations and statusLine into existing settings immutably.
 *
 * @param settings - The current settings.json contents.
 * @param desired - The desired hook registrations.
 * @param statusLineCommand - The statusLine command string.
 * @returns A new settings object with hooks and statusLine merged.
 */
function mergeSettings(
  settings: Record<string, unknown>,
  desired: HookRegistrations,
  statusLineCommand: string,
): Record<string, unknown> {
  // Safe: best-effort — malformed hooks degrade gracefully in mergeEventEntries
  const existingHooks = (settings.hooks ?? {}) as HookRegistrations;
  const mergedHooks = mergeHookRegistrations(existingHooks, desired);
  const statusLine = settings.statusLine ?? {
    type: 'command',
    command: statusLineCommand,
  };

  return { ...settings, hooks: mergedHooks, statusLine };
}

/** Copy all hook files from source to the install directory. */
function copyHookFiles(sourceDir: string, installDir: string): void {
  mkdirSync(installDir, { recursive: true });

  HOOK_FILES.forEach((f) => {
    copyFileSync(join(sourceDir, f), join(installDir, f));
  });
}

/** Write a CommonJS package.json so hooks resolve as CJS in ESM projects. */
function writeCommonJsMarker(installDir: string): void {
  writeFileSync(
    join(installDir, 'package.json'),
    JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
  );
}

/** Read and parse settings.json, returning empty on ENOENT or malformed JSON. */
function readSettingsFile(settingsFile: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(settingsFile, 'utf8')) as Record<
      string,
      unknown
    >;
  } catch (err: unknown) {
    const isNotFound =
      err instanceof Error &&
      (err as { readonly code?: string }).code === 'ENOENT';
    const isParseError = err instanceof SyntaxError;

    if (isNotFound || isParseError) return {};

    throw err;
  }
}

/**
 * Install Clancy hooks into the Claude config directory.
 *
 * Copies hook scripts, writes a CommonJS `package.json` to the hooks dir,
 * and merges hook registrations into `settings.json`.
 *
 * Best-effort — never throws. Returns `false` if installation fails.
 *
 * @param options - The hook installer options.
 * @returns `true` if hooks were installed successfully.
 */
export function installHooks(options: HookInstallerOptions): boolean {
  const { claudeConfigDir, hooksSourceDir } = options;
  const hooksInstallDir = join(claudeConfigDir, 'hooks');
  const settingsFile = join(claudeConfigDir, 'settings.json');

  try {
    copyHookFiles(hooksSourceDir, hooksInstallDir);
    writeCommonJsMarker(hooksInstallDir);

    const existing = readSettingsFile(settingsFile);
    const desired = buildDesiredHooks(
      hooksInstallDir,
      options.verificationGatePrompt,
    );
    const statusLineCmd = buildNodeCommand(
      hooksInstallDir,
      'clancy-statusline.js',
    );
    const merged = mergeSettings(existing, desired, statusLineCmd);

    writeFileSync(settingsFile, JSON.stringify(merged, null, 2) + '\n');

    return true;
  } catch {
    return false;
  }
}
