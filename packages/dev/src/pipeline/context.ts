/**
 * Pipeline context — shared state threaded through all orchestrator phases.
 *
 * `RunContext` is a class (not a plain object) because the ESLint
 * `functional/immutable-data` rule flags `obj.field = value` on plain
 * objects, but `ignoreClasses: true` allows class property mutation.
 * Each phase reads from and mutates this context. Fields are populated
 * progressively — phases that depend on prior state assert required
 * fields at the top (a missing field means a pipeline ordering bug).
 */
import type { BoardConfig } from '@chief-clancy/core/schemas/env/env.js';
import type { Board, FetchedTicket } from '@chief-clancy/core/types/board.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Options for creating a new {@link RunContext}. */
type CreateContextOpts = {
  /** Absolute path to the project root directory. */
  readonly projectRoot: string;
  /** Process arguments (e.g. `['--dry-run']`). */
  readonly argv: readonly string[];
  /** Whether the runner is in AFK (unattended) mode. */
  readonly isAfk?: boolean;
  /** Timestamp override for deterministic testing (default: `Date.now()`). */
  readonly now?: number;
};

// ─── RunContext class ────────────────────────────────────────────────────────

/**
 * Shared state threaded through all orchestrator phases.
 *
 * Fixed fields are set at creation and never change. Phase-populated
 * fields start `undefined` and are set progressively by each phase.
 */
export class RunContext {
  // ── Fixed at creation ──────────────────────────────────────────────

  readonly projectRoot: string;
  readonly argv: readonly string[];
  readonly dryRun: boolean;
  readonly skipFeasibility: boolean;
  readonly startTime: number;
  readonly isAfk: boolean;

  /* eslint-disable functional/prefer-readonly-type -- phase-populated fields are mutated progressively */

  // ── Populated by preflight phase ───────────────────────────────────

  config: BoardConfig | undefined;
  board: Board | undefined;

  // ── Populated by rework / ticket-fetch phases ──────────────────────

  ticket: FetchedTicket | undefined;
  isRework: boolean | undefined;
  prFeedback: readonly string[] | undefined;
  reworkPrNumber: number | undefined;
  reworkDiscussionIds: readonly string[] | undefined;
  reworkReviewers: readonly string[] | undefined;

  // ── Populated by ticket-fetch / branch-setup phases ─────────────────

  ticketBranch: string | undefined;
  targetBranch: string | undefined;
  effectiveTarget: string | undefined;
  baseBranch: string | undefined;
  originalBranch: string | undefined;
  skipEpicBranch: boolean | undefined;
  hasParent: boolean | undefined;

  // ── Populated by lock-write phase ──────────────────────────────────

  lockOwner: boolean | undefined;

  /* eslint-enable functional/prefer-readonly-type */

  // ── Setter methods ─────────────────────────────────────────────────

  /** Set preflight-phase fields. */
  setPreflight(config: BoardConfig, board: Board): void {
    this.config = config;
    this.board = board;
  }

  /** Set rework-detection fields. */
  setRework(opts: {
    readonly isRework: boolean;
    readonly prFeedback?: readonly string[];
    readonly reworkPrNumber?: number;
    readonly reworkDiscussionIds?: readonly string[];
    readonly reworkReviewers?: readonly string[];
  }): void {
    this.isRework = opts.isRework;
    this.prFeedback = opts.prFeedback;
    this.reworkPrNumber = opts.reworkPrNumber;
    this.reworkDiscussionIds = opts.reworkDiscussionIds;
    this.reworkReviewers = opts.reworkReviewers;
  }

  /** Set ticket from ticket-fetch phase. */
  setTicket(ticket: FetchedTicket): void {
    this.ticket = ticket;
  }

  /**
   * Set computed branch names from ticket-fetch phase.
   *
   * Note: `setBranchSetup` intentionally overwrites the 4 shared fields
   * (`ticketBranch`, `targetBranch`, `baseBranch`, `hasParent`) set here,
   * as branch-setup may compute different values (e.g. adjusted effective
   * target after single-child detection).
   */
  setTicketBranches(opts: {
    readonly ticketBranch: string;
    readonly targetBranch: string;
    readonly baseBranch: string;
    readonly hasParent: boolean;
  }): void {
    this.ticketBranch = opts.ticketBranch;
    this.targetBranch = opts.targetBranch;
    this.baseBranch = opts.baseBranch;
    this.hasParent = opts.hasParent;
  }

  /** Set branch-setup fields. */
  setBranchSetup(opts: {
    readonly ticketBranch: string;
    readonly targetBranch: string;
    readonly effectiveTarget: string;
    readonly baseBranch?: string;
    readonly originalBranch?: string;
    readonly skipEpicBranch?: boolean;
    readonly hasParent?: boolean;
  }): void {
    this.ticketBranch = opts.ticketBranch;
    this.targetBranch = opts.targetBranch;
    this.effectiveTarget = opts.effectiveTarget;
    this.baseBranch = opts.baseBranch;
    this.originalBranch = opts.originalBranch;
    this.skipEpicBranch = opts.skipEpicBranch;
    this.hasParent = opts.hasParent;
  }

  /** Set lock ownership flag. */
  setLockOwner(value: boolean): void {
    this.lockOwner = value;
  }

  constructor(opts: CreateContextOpts) {
    this.projectRoot = opts.projectRoot;
    this.argv = opts.argv;
    this.dryRun = opts.argv.includes('--dry-run');
    this.skipFeasibility = opts.argv.includes('--skip-feasibility');
    this.startTime = opts.now ?? Date.now();
    this.isAfk = opts.isAfk ?? false;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create the initial RunContext from options.
 *
 * Uses explicit parameters instead of `process.cwd()` / `process.env`
 * for testability. The terminal layer is responsible for reading those
 * globals and passing them in.
 *
 * @param opts - Creation options (projectRoot, argv, isAfk).
 * @returns A new `RunContext` with fixed fields set and phase fields undefined.
 */
export function createContext(opts: CreateContextOpts): RunContext {
  return new RunContext(opts);
}
