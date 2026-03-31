# Reviewer Role

The reviewer scores ticket readiness and tracks what Clancy has done.

## Commands

| Command          | What it does                                                           |
| ---------------- | ---------------------------------------------------------------------- |
| `/clancy:review` | Score the next ticket's readiness across 7 weighted criteria           |
| `/clancy:status` | Show the current state of your board queue                             |
| `/clancy:logs`   | Display the progress log — what was implemented, when, and the outcome |

## Review scoring

`/clancy:review` evaluates the next ticket in the implementation queue and produces a weighted confidence score (0-100%) across 7 criteria:

| Criterion              | Weight | What it checks                                       |
| ---------------------- | ------ | ---------------------------------------------------- |
| Summary clarity        | 10%    | Is the title clear and actionable?                   |
| Description quality    | 15%    | Is there enough detail to implement?                 |
| Acceptance criteria    | 25%    | Are there testable pass/fail criteria?               |
| Figma URL (UI tickets) | 15%    | Is a design reference provided for visual work?      |
| Scope realism          | 15%    | Is the ticket appropriately scoped for a single run? |
| Dependencies stated    | 5%     | Are blocking tickets or prerequisites documented?    |
| Clancy executability   | 15%    | Can this be implemented entirely as code changes?    |

This helps you catch tickets that need refinement before Clancy attempts to implement them.

## Status

`/clancy:status` gives a snapshot of your board queue — how many tickets are ready, in progress, or done.

## Logs

`/clancy:logs` reads `.clancy/progress.txt` and displays a formatted view of all Clancy activity:

```
YYYY-MM-DD HH:MM | PROJ-123 | Implement login form | DONE
YYYY-MM-DD HH:MM | PROJ-124 | Fix validation bug | DONE
YYYY-MM-DD HH:MM | PROJ-125 | PLAN | S/M/L
YYYY-MM-DD HH:MM | PROJ-125 | APPROVE | —
```

Each entry includes the timestamp, ticket key, action summary, and status.
