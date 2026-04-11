/**
 * Board-related types shared across board implementations.
 */

/** Supported board providers. */
export type BoardProvider =
  | 'jira'
  | 'github'
  | 'linear'
  | 'shortcut'
  | 'notion'
  | 'azdo';

/** A normalised ticket from any board provider. */
export type Ticket = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly provider: BoardProvider;
};

/** Normalised ticket representation returned by board fetch operations. */
export type FetchedTicket = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly parentInfo: string;
  readonly blockers: string;
  /** Linear internal issue ID — needed for state transitions. */
  readonly linearIssueId?: string;
  /** Board-specific issue ID — needed for feedback fetching (e.g., Linear UUID). */
  readonly issueId?: string;
  /** Label names present on the ticket — used for pipeline label guard. */
  readonly labels?: readonly string[];
  /** Board status at fetch time — used for claim detection (e.g., "To Do", "unstarted"). */
  readonly status?: string;
  /** Board-specific work type — mapped to commit type for PR titles (e.g., "Bug", "feature", "Task"). */
  readonly ticketType?: string;
};

/** Options for ticket fetching behaviour. */
export type FetchTicketOpts = {
  /** If `true`, excludes tickets with the `clancy:hitl` label. */
  readonly excludeHitl?: boolean;
  /** The resolved build queue label to filter by (e.g. `clancy:build`). */
  readonly buildLabel?: string;
  /** Maximum number of tickets to return. Defaults to 5 per provider. */
  readonly limit?: number;
};

/** Result of a board connectivity check. */
export type PingResult = {
  readonly ok: boolean;
  readonly error?: string;
};

/** Count of child tickets and how many remain incomplete. */
export type ChildrenStatus = {
  readonly total: number;
  readonly incomplete: number;
};

/** Standardised board abstraction. */
export type Board = {
  readonly ping: () => Promise<PingResult>;
  readonly validateInputs: () => string | undefined;
  readonly fetchTicket: (
    opts: FetchTicketOpts,
  ) => Promise<FetchedTicket | undefined>;
  readonly fetchTickets: (
    opts: FetchTicketOpts,
  ) => Promise<readonly FetchedTicket[]>;
  readonly fetchBlockerStatus: (ticket: FetchedTicket) => Promise<boolean>;
  readonly fetchChildrenStatus: (
    parentKey: string,
    parentId?: string,
    currentTicketKey?: string,
  ) => Promise<ChildrenStatus | undefined>;
  readonly transitionTicket: (
    ticket: FetchedTicket,
    status: string,
  ) => Promise<boolean>;
  readonly ensureLabel: (label: string) => Promise<void>;
  readonly addLabel: (issueKey: string, label: string) => Promise<void>;
  readonly removeLabel: (issueKey: string, label: string) => Promise<void>;
  readonly sharedEnv: () => Record<string, string | undefined>;
};
