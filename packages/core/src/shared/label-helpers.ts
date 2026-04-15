/**
 * Shared label CRUD helpers for board wrappers.
 *
 * Boards with a read-modify-write pattern for labels (Jira, Shortcut,
 * Notion, Azure DevOps) use {@link modifyLabelList} to eliminate the
 * duplicated fetch → check → write boilerplate. All label operations
 * wrap in {@link safeLabel} for consistent error handling.
 */

/**
 * Wrap a label operation in try-catch with a warning on failure.
 *
 * Label operations are best-effort — they should never crash the run.
 *
 * @param fn - The async label operation to execute.
 * @param operation - Human-readable name for error messages (e.g., `'addLabel'`).
 * @returns Resolves when complete — never rejects.
 */
export async function safeLabel(
  fn: () => Promise<void>,
  operation: string,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.warn(
      `⚠ ${operation} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Options for {@link modifyLabelList}. */
export type ModifyLabelListOpts<T extends string | number> = {
  /** Board-specific function to fetch current labels. */
  readonly fetchCurrent: () => Promise<readonly T[] | undefined>;
  /** Board-specific function to write the updated list. */
  readonly writeUpdated: (updated: readonly T[]) => Promise<void>;
  /** The label (or ID) to add or remove. */
  readonly target: T;
  /** Whether to add or remove the target. */
  readonly mode: 'add' | 'remove';
};

/**
 * Read-modify-write a label list with idempotence checking.
 *
 * Fetches the current labels, checks if the target is already present
 * (add) or absent (remove), and writes the updated list only when a
 * change is needed. Works with string labels and numeric IDs.
 *
 * @param opts - Fetch/write callbacks, target label, and add/remove mode.
 * @returns Resolves when the write completes (no-op if unchanged).
 */
export async function modifyLabelList<T extends string | number>(
  opts: ModifyLabelListOpts<T>,
): Promise<void> {
  const { fetchCurrent, writeUpdated, target, mode } = opts;
  const current = await fetchCurrent();
  if (!current) return;

  const has = current.includes(target);
  if (mode === 'add' && has) return;
  if (mode === 'remove' && !has) return;

  const updated =
    mode === 'add'
      ? [...current, target]
      : current.filter((item) => item !== target);
  await writeUpdated(updated);
}
