/**
 * Hook installer for Claude Code settings.
 *
 * Copies compiled hook scripts into the Claude config directory and
 * registers them in `settings.json` without clobbering existing config.
 * All internal logic is immutable — settings are built as new objects,
 * never mutated in place.
 */
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
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

/** Check whether an error has a specific Node.js error code. */
function hasErrorCode(err: unknown, code: string): boolean {
  return (
    err instanceof Error && (err as { readonly code?: string }).code === code
  );
}

/** Throw if the given path is a symlink. Only swallows ENOENT. */
function rejectSymlink(path: string): void {
  try {
    if (lstatSync(path).isSymbolicLink()) {
      throw new Error(`${path} is a symlink. Remove it before installing.`);
    }
  } catch (err: unknown) {
    if (!hasErrorCode(err, 'ENOENT')) throw err;
  }
}

/** Check whether a value is a plain object (not array, not null). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

/** Check whether a single hook matches a given command string. */
function isCommandMatch(
  hook: CommandHook | AgentHook,
  command: string,
): boolean {
  return hook.type === 'command' && hook.command === command;
}

/** Check whether a single hook matches an agent prompt fingerprint. */
function isAgentMatch(
  hook: CommandHook | AgentHook,
  fingerprint: string,
): boolean {
  const hasStringPrompt =
    hook.type === 'agent' && typeof hook.prompt === 'string';

  return hasStringPrompt && hook.prompt.slice(0, 100) === fingerprint;
}

/** Flatten all hooks from a list of entries, filtering out non-object values. */
function allHooks(
  entries: readonly HookEntry[],
): readonly (CommandHook | AgentHook)[] {
  return entries
    .flatMap((e) => e.hooks)
    .filter((h): h is CommandHook | AgentHook => isPlainObject(h));
}

/** Check whether an event's entries already contain a given command. */
function hasCommand(entries: readonly HookEntry[], command: string): boolean {
  return allHooks(entries).some((h) => isCommandMatch(h, command));
}

/** Check whether an event's entries already contain a matching agent prompt. */
function hasAgentPrompt(
  entries: readonly HookEntry[],
  prompt: string,
): boolean {
  const fingerprint = prompt.slice(0, 100);

  return allHooks(entries).some((h) => isAgentMatch(h, fingerprint));
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

/** Check whether a value looks like a HookEntry ({ hooks: [...] }). */
function isHookEntry(value: unknown): value is HookEntry {
  if (!isPlainObject(value)) return false;
  const hooks = (value as { readonly hooks?: unknown }).hooks;

  return Array.isArray(hooks);
}

/** Safely extract a HookRegistrations record from raw settings.hooks. */
function normalizeHooks(raw: unknown): HookRegistrations {
  if (!isPlainObject(raw)) return {};

  const safeEntries = Object.entries(raw)
    .filter(([, value]) => Array.isArray(value))
    .map(
      ([event, value]) =>
        [event, (value as readonly unknown[]).filter(isHookEntry)] as const,
    );

  return Object.fromEntries(safeEntries);
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
  const existingHooks = normalizeHooks(settings.hooks);
  const mergedHooks = mergeHookRegistrations(existingHooks, desired);
  const statusLine = settings.statusLine ?? {
    type: 'command',
    command: statusLineCommand,
  };

  return { ...settings, hooks: mergedHooks, statusLine };
}

/** Copy all hook files from source to the install directory. */
function copyHookFiles(sourceDir: string, installDir: string): void {
  rejectSymlink(installDir);
  mkdirSync(installDir, { recursive: true });

  HOOK_FILES.forEach((f) => {
    const dest = join(installDir, f);
    rejectSymlink(dest);
    copyFileSync(join(sourceDir, f), dest);
  });
}

/** Write a CommonJS package.json so hooks resolve as CJS in ESM projects. */
function writeCommonJsMarker(installDir: string): void {
  const packageJsonPath = join(installDir, 'package.json');
  rejectSymlink(packageJsonPath);

  writeFileSync(
    packageJsonPath,
    JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
  );
}

/** Read and parse settings.json, returning empty on ENOENT or malformed JSON. */
function readSettingsFile(settingsFile: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(settingsFile, 'utf8'));

    return isPlainObject(parsed) ? parsed : {};
  } catch (err: unknown) {
    if (hasErrorCode(err, 'ENOENT') || err instanceof SyntaxError) return {};

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

    rejectSymlink(settingsFile);
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
