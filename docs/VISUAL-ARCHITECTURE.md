# Clancy — Visual Architecture

Interactive diagrams showing how packages, roles, commands, and flows connect. Rendered natively by GitHub.

## Table of Contents

1. [Package Boundaries](#1-package-boundaries) — monorepo structure and dependency flow
2. [Role & Command Map](#2-role--command-map) — all roles and their commands
3. [Ticket Lifecycle](#3-ticket-lifecycle--end-to-end) — state machine from idea to merged code
4. [Implementation Flow](#4-implementation-flow) — what happens inside `/clancy:implement`
5. [Strategist Flow](#5-strategist-flow--brief-to-tickets) — `/clancy:brief` and `/clancy:approve-brief`
6. [Board API Matrix](#6-board-api-interaction-matrix) — which commands talk to which APIs
7. [File Artifacts](#7-file-artifacts--what-lives-in-clancy) — everything in `.clancy/`
8. [Delivery Paths](#8-delivery-paths--pr-flow-with-epic-branches) — PR flow with epic branches
9. [Prompt Building](#9-prompt-building--what-claude-receives) — what Claude gets for implementation and rework
10. [Planner Flow](#10-planner-flow--plan-to-approval) — `/clancy:plan` and `/clancy:approve-plan`
11. [Hook Architecture](#11-hook-architecture--events-and-hooks) — which hooks fire on which events
12. [Grill Phase](#12-grill-phase--human-vs-ai-grill) — decision tree for grill mode
13. [Build Pipeline](#13-build-pipeline) — how packages are built and published

---

## 1. Package Boundaries

Seven packages. Dependency direction is strict: `core ← terminal ← chief-clancy`. The standalone packages each have their own `npx @chief-clancy/{pkg}` entry point and can be installed independently of `terminal`:

- `scan` — no package dependencies
- `brief` and `plan` — depend on `scan` only
- `dev` — depends on `core` and `scan` (uses `core` for board integrations, schemas, shared utilities)

No reverse imports. Enforced by eslint-plugin-boundaries.

```mermaid
graph TD
    subgraph chief["chief-clancy (CLI wrapper)"]
        bin["bin/clancy.js"]
    end

    subgraph terminal["@chief-clancy/terminal"]
        installer["installer/"]
        runner["runner/"]
        hooks["hooks/"]
        roles["roles/\n(setup, implementer, reviewer)"]
        agents["agents/"]
        templates["templates/"]
    end

    subgraph core["@chief-clancy/core"]
        board["board/\n(GitHub, Jira, Linear,\nShortcut, Notion, Azure DevOps)"]
        types["types/"]
        schemas["schemas/\n(Zod/mini validation)"]
        shared["shared/\n(cache, http, git-ops,\nenv-parser, remote)"]
    end

    subgraph brief["@chief-clancy/brief (standalone)"]
        briefInstaller["installer/"]
        briefCommands["commands/\n(brief, approve-brief,\nboard-setup)"]
        briefWorkflows["workflows/"]
        briefAgents["agents/\n(devils-advocate.md)"]
    end

    subgraph plan["@chief-clancy/plan (standalone)"]
        planInstaller["installer/"]
        planCommands["commands/\n(plan, approve-plan)"]
        planWorkflows["workflows/"]
    end

    subgraph scan["@chief-clancy/scan (standalone)"]
        scanInstaller["installer/"]
        scanCommands["commands/\n(map-codebase, update-docs)"]
        scanAgents["agents/ (5 specialists)"]
    end

    subgraph dev["@chief-clancy/dev (standalone from terminal — uses core)"]
        devInstaller["installer/"]
        devPipeline["pipeline/\n(phase orchestrator)"]
        devLifecycle["lifecycle/\n(ticket lifecycle modules)"]
        devRuntime["runtime/\n(esbuild bundles for .clancy/)"]
    end

    bin --> installer
    installer --> hooks
    runner --> devPipeline
    runner --> devLifecycle
    devPipeline --> devLifecycle
    devPipeline --> board
    devLifecycle --> board
    devLifecycle --> shared
    brief --> scanCommands
    plan --> scanCommands
    board --> schemas
    board --> shared

    style chief stroke:#6a1b9a,stroke-width:2px
    style terminal stroke:#c62828,stroke-width:2px
    style core stroke:#1565c0,stroke-width:2px
    style brief stroke:#2e7d32,stroke-width:2px
    style plan stroke:#2e7d32,stroke-width:2px
    style scan stroke:#2e7d32,stroke-width:2px
    style dev stroke:#2e7d32,stroke-width:2px
```

---

## 2. Role & Command Map

Every command organised by role. Core roles are always installed; optional roles opt-in via `CLANCY_ROLES`.

```mermaid
graph TB
    subgraph SETUP["Setup & Maintenance (core)"]
        init["/clancy:init"]
        settings["/clancy:settings"]
        doctor["/clancy:doctor"]
        mapcb["/clancy:map-codebase"]
        updatedocs["/clancy:update-docs"]
        update["/clancy:update-terminal"]
        uninstall["/clancy:uninstall-terminal"]
        help["/clancy:help"]
    end

    subgraph STRATEGIST["Strategist (optional)"]
        brief["/clancy:brief"]
        approvebrief["/clancy:approve-brief"]
    end

    subgraph PLANNER["Planner (optional)"]
        plan["/clancy:plan"]
        approveplan["/clancy:approve-plan"]
    end

    subgraph IMPLEMENTER["Implementer (core)"]
        once["/clancy:implement"]
        run["/clancy:autopilot"]
        dryrun["/clancy:dry-run"]
    end

    subgraph REVIEWER["Reviewer (core)"]
        review["/clancy:review"]
        status["/clancy:status"]
        logs["/clancy:logs"]
    end

    init -->|scaffolds .clancy/| mapcb
    mapcb -->|generates docs| brief
    brief -->|produces brief| approvebrief
    approvebrief -->|creates tickets| plan
    plan -->|produces plan| approveplan
    approveplan -->|promotes to impl queue| once
    once -->|implements ticket| review
    run -->|loops once| once
    review -->|scores implementation| logs

    style SETUP stroke:#2e7d32,stroke-width:2px
    style STRATEGIST stroke:#e65100,stroke-width:2px
    style PLANNER stroke:#1565c0,stroke-width:2px
    style IMPLEMENTER stroke:#c62828,stroke-width:2px
    style REVIEWER stroke:#6a1b9a,stroke-width:2px
```

---

## 3. Lifecycle — End to End

A unit of work's complete journey from vague idea to merged code. Runs on two parallel paths — the **board path** (tickets move through the `clancy:brief → clancy:plan → clancy:build` label pipeline) or the **local path** (briefs and plans live as files in `.clancy/briefs/` and `.clancy/plans/`, with a `.approved` marker file gating implementation).

```mermaid
stateDiagram-v2
    [*] --> Idea: Vague idea

    state "Strategist (optional)" as strat {
        Idea --> Grill: /clancy:brief (board)\nor /clancy:brief --from {outline} (local)
        Grill --> Brief: Generate brief
        Brief --> ReviewBrief: Human reviews
        ReviewBrief --> Brief: Feedback → revise
        ReviewBrief --> Tickets: /clancy:approve-brief\n(board path only —\nlocal path has no approve-brief step)
    }

    state "Planner (optional)" as plnr {
        Tickets --> Backlog: Tickets with\nclancy:plan label
        Backlog --> Planning: /clancy:plan (board)\nor /clancy:plan --from {brief} (local)
        Planning --> ReviewPlan: Human reviews plan
        ReviewPlan --> Planning: Feedback → revise
        ReviewPlan --> Ready: /clancy:approve-plan\n(board: − clancy:plan + clancy:build\nlocal: writes .approved marker)
    }

    state "Implementer" as impl {
        Ready --> InProgress: /clancy:implement (board, filters clancy:build)\nor /clancy:implement --from {plan.md} (local, checks .approved)
        InProgress --> Claude: Invoke Claude session
        Claude --> Deliver: Code committed
    }

    state "Delivery" as deliv {
        Deliver --> PRCreated: Push + create PR
        PRCreated --> Rework: Review feedback?
        Rework --> PRCreated: Push fixes
        PRCreated --> ChildDone: Approved + merged
    }

    state "Epic Completion (board path only)" as epic {
        ChildDone --> EpicCheck: Has parent?
        ChildDone --> Done: No parent
        EpicCheck --> EpicPR: All children done?
        EpicCheck --> Done: More children remain
        EpicPR --> Done: Epic PR approved + merged
    }

    Done --> [*]

    note right of Grill
        Human grill (interactive)
        or AI-grill (--afk)
    end note

    note right of Rework
        Max 3 cycles
        then human intervention
    end note
```

---

## 4. Implementation Flow

What happens inside `/clancy:implement` (and each iteration of `/clancy:autopilot`). Phase logic lives in `dev/src/pipeline/phases/`; Claude invocation lives in `terminal/runner/`.

```mermaid
flowchart TD
    Start(["/clancy:implement\n(or --from <plan.md>)"]) --> LockCheck

    LockCheck{"Lock file\nexists?"} -->|No| AcquireLock["Acquire lock\n(.clancy/lock.json)"]
    LockCheck -->|"Yes — PID alive"| Stop0["Another session running ✗"]
    LockCheck -->|"Yes — PID dead"| Resume["Resume crashed session\n(read ticket + branch from lock)"]

    AcquireLock --> FromFlag{"--from\n<plan>?"}
    Resume --> Branch

    FromFlag -->|No — board path| Preflight
    FromFlag -->|Yes — local path| LocalPreflight

    subgraph Preflight["Board Preflight"]
        P1[".clancy/.env exists?"] -->|No| Stop1["Run /clancy:init first ✗"]
        P1 -->|Yes| P2["Parse env, detect board"]
        P2 --> P3["Ping board credentials"]
        P3 -->|Fail| Stop2["Check credentials ✗"]
        P3 -->|OK| P4["Git connectivity check"]
        P4 --> P5["Branch freshness check"]
    end

    subgraph LocalPreflight["Local Preflight (--from)"]
        L1["Validate plan path"] -->|Missing| Stop1b["Plan file not found ✗"]
        L1 --> L2["Check sibling .approved marker"]
        L2 -->|Missing| Stop2b["Plan not approved —\nrun /clancy:approve-plan ✗"]
        L2 -->|Hash mismatch| Stop2c["Plan changed since approval —\ndelete marker and re-approve ✗"]
        L2 -->|OK| L3["Git connectivity check"]
        L3 --> L4["Branch freshness check"]
    end

    P5 --> EpicScan
    L4 --> FetchTicket

    EpicScan["Epic completion scan\n(check if any epics have\nall children done → create\nepic PR if so — board only)"] --> FetchTicket

    subgraph FetchTicket["Resolve Target"]
        F1["Board path: query for next ticket\nLocal path: synthesise ticket from plan"] -->|None found| Stop3["No tickets — all done"]
        F1 -->|Found| F2["Check for rework\n(scan progress.txt — board only;\nlocal path skips)"]
        F2 -->|PR has feedback| Rework["Build rework prompt"]
        F2 -->|No rework or local| F3["Fresh target"]
    end

    F3 --> DryRun
    Rework --> DryRun

    DryRun{"--dry-run?"} -->|Yes| Stop4["Preview shown, no changes"]
    DryRun -->|No| Feasibility

    Feasibility["Feasibility check\n(can this be a code change?)"] -->|Skip| Stop5["⚠ Skipping — not code work"]
    Feasibility -->|OK| Branch

    Branch["Create/checkout\nfeature branch"] --> Transition["Transition → In Progress"]
    Transition --> BuildPrompt

    BuildPrompt["Build prompt\n(ticket + docs + TDD?)"] --> InvokeClaude["Invoke Claude session\n(claude -p --dangerously-skip-permissions)"]

    InvokeClaude -->|Success| VerifyGate
    InvokeClaude -->|Fail| Stop6["Claude session failed ✗"]

    subgraph VerifyGate["Verification Gate"]
        V1["Run lint/test/typecheck"] -->|Pass| VPass["Checks passed ✓"]
        V1 -->|Fail| V2{"Retries\nremaining?"}
        V2 -->|Yes| V3["Self-healing fix\n(feed errors to Claude)"]
        V3 --> V1
        V2 -->|No| VWarn["Deliver with\nverification warning"]
    end

    VPass --> PRDeliver["Push feature branch\nCreate PR/MR\nTransition → Review"]
    VWarn --> PRDeliver

    PRDeliver --> Log["Log to progress.txt"]
    Log --> Cost["Cost log\n(.clancy/costs.log)"]
    Cost --> ReleaseLock["Release lock file"]

    ReleaseLock --> Notify["Send notification\n(webhook, if configured)"]
    Notify --> End(["Done"])

    style Stop0 stroke:#c62828,stroke-width:2px
    style Stop1 stroke:#c62828,stroke-width:2px
    style Stop2 stroke:#c62828,stroke-width:2px
    style Stop3 stroke:#f9a825,stroke-width:2px
    style Stop4 stroke:#1565c0,stroke-width:2px
    style Stop5 stroke:#f9a825,stroke-width:2px
    style Stop6 stroke:#c62828,stroke-width:2px
    style VerifyGate stroke:#2e7d32,stroke-width:2px
```

---

## 5. Strategist Flow — Brief to Tickets

The strategist's two commands: `/clancy:brief` (idea → brief) and `/clancy:approve-brief` (brief → board tickets).

```mermaid
flowchart TD
    Start(["/clancy:brief"]) --> Input["Parse input\n(ticket / text / file / interactive)"]

    Input --> GrillMode{"Grill mode?"}
    GrillMode -->|"--afk or CLANCY_MODE=afk"| AIGrill["AI-Grill\nDevil's advocate agent\n(codebase + board + web)"]
    GrillMode -->|Interactive| HumanGrill["Human Grill\nMulti-round Q&A\n(2-5 rounds)"]

    AIGrill --> Discovery["## Discovery\n(source-tagged Q&A)"]
    HumanGrill --> Discovery

    Discovery --> Relevance{"Relevant to\ncodebase?"}
    Relevance -->|No| Skip["⚠ Skipping — wrong stack"]
    Relevance -->|Yes| Research

    Research["Adaptive research\n1-4 agents\n(codebase + web)"] --> Generate["Generate brief\n(template + decomposition)"]

    Generate --> Save["Save to\n.clancy/briefs/"]
    Save --> PostBoard{"Board-sourced?"}
    PostBoard -->|Yes| Comment["Post as comment\non source ticket"]
    PostBoard -->|No| Display
    Comment --> Display["Display brief\n+ next steps"]

    Display --> ReviewLoop{"PO feedback?"}
    ReviewLoop -->|Yes| Revise["Re-run /clancy:brief\n(auto-detect feedback)"]
    Revise --> Discovery
    ReviewLoop -->|No| Approve

    Approve(["/clancy:approve-brief"]) --> Parse["Parse decomposition\ntable from brief"]
    Parse --> Topo["Topological sort\n(dependency order)"]
    Topo --> Confirm["Confirm with user\n(show HITL/AFK breakdown)"]
    Confirm -->|No| Cancel["Cancelled"]
    Confirm -->|Yes| Create

    Create["Create tickets on board\n(sequential, 500ms delay)\nLabels: clancy:afk / clancy:hitl\nDescription includes Epic: {key}"]
    Create --> Link["Link dependencies\n(blocking relationships)"]
    Link --> MarkApproved["Mark brief .approved"]
    MarkApproved --> Summary["Display summary\n→ Next: /clancy:plan"]

    style Skip stroke:#f9a825,stroke-width:2px
    style Cancel stroke:#c62828,stroke-width:2px
    style AIGrill stroke:#1565c0,stroke-width:2px
    style HumanGrill stroke:#2e7d32,stroke-width:2px
```

---

## 6. Board API Interaction Matrix

Which commands talk to which board APIs, and what operations they perform.

```mermaid
graph LR
    subgraph Commands
        brief["/clancy:brief"]
        approvebrief["/clancy:approve-brief"]
        plan["/clancy:plan"]
        approveplan["/clancy:approve-plan"]
        once["/clancy:implement"]
        status["/clancy:status"]
    end

    subgraph Operations
        fetch["Fetch tickets"]
        create["Create tickets"]
        transition["Transition status"]
        comment["Post comment"]
        link["Link dependencies"]
        close["Close / Done"]
        labelop["Label management\n(ensure/add/remove)"]
    end

    subgraph Boards
        jira[(Jira Cloud)]
        github[(GitHub Issues)]
        linear[(Linear)]
        shortcut[(Shortcut)]
        notion[(Notion)]
        azdo[(Azure DevOps)]
    end

    brief --> fetch
    brief --> comment
    brief --> labelop
    approvebrief --> create
    approvebrief --> link
    approvebrief --> comment
    approvebrief --> labelop
    plan --> fetch
    plan --> comment
    approveplan --> fetch
    approveplan --> transition
    approveplan --> labelop
    once --> fetch
    once --> transition
    once --> close
    status --> fetch

    fetch --> jira
    fetch --> github
    fetch --> linear
    fetch --> shortcut
    fetch --> notion
    fetch --> azdo
    create --> jira
    create --> github
    create --> linear
    create --> shortcut
    create --> notion
    create --> azdo
    transition --> jira
    transition --> linear
    transition --> shortcut
    transition --> notion
    transition --> azdo
    comment --> jira
    comment --> github
    comment --> linear
    link --> jira
    link --> linear
    close --> jira
    close --> github
    close --> linear
    labelop --> jira
    labelop --> github
    labelop --> linear
    labelop --> shortcut
    labelop --> notion
    labelop --> azdo

    style jira fill:#0052CC,color:#fff
    style github fill:#24292e,color:#fff
    style linear fill:#5E6AD2,color:#fff
```

---

## 7. File Artifacts — What Lives in `.clancy/`

Everything Clancy creates and reads in the user's project.

```mermaid
graph TD
    subgraph ".clancy/"
        env[".env\n(optional board creds + config —\nabsent board markers = local mode)"]
        oncejs["clancy-implement.js\n(esbuild bundle)"]
        afkjs["clancy-autopilot.js\n(esbuild bundle)"]
        pkg["package.json\n({'type':'module'})"]
        progress["progress.txt\n(run log)"]
        costslog["costs.log\n(token cost estimates)"]
        lockfile["lock.json\n(crash recovery)"]
        sessionrpt["session-report.md\n(AFK summary)"]
        claudemd["CLAUDE.md\n(project instructions)"]

        subgraph "docs/"
            stack["STACK.md"]
            arch["ARCHITECTURE.md"]
            conv["CONVENTIONS.md"]
            test["TESTING.md"]
            dod["DEFINITION-OF-DONE.md"]
            design["DESIGN-SYSTEM.md"]
            a11y["ACCESSIBILITY.md"]
        end

        subgraph "briefs/"
            brief1["2026-03-18-dark-mode.md"]
            brief2["2026-03-17-auth-rework.md"]
            briefFb["...feedback.md\n(companion file)"]
        end

        subgraph "plans/"
            plan1["{plan-id}.md"]
            plan1a["{plan-id}.approved\n(SHA-256 + approved_at —\ngate for /clancy:implement --from)"]
            plan2["{plan-id}.md"]
            planFb["...feedback.md\n(companion file)"]
        end
    end

    init(["/clancy:init"]) -->|creates| env
    init -->|copies| oncejs
    init -->|copies| afkjs
    init -->|writes| pkg

    mapcb(["/clancy:map-codebase"]) -->|generates| stack
    mapcb -->|generates| arch
    mapcb -->|generates| conv
    mapcb -->|generates| test

    brief(["/clancy:brief\n(or --from <outline>)"]) -->|writes| brief1
    plan(["/clancy:plan\n(or --from <brief>)"]) -->|writes| plan1
    approveplan(["/clancy:approve-plan"]) -->|writes marker| plan1a

    once(["/clancy:implement\n(or --from <plan.md>)"]) -->|reads| env
    once -->|reads| stack
    once -->|"local path: reads + verifies"| plan1a
    once -->|appends| progress
    once -->|executes| oncejs

    logs(["/clancy:logs"]) -->|reads| progress

    style env stroke:#e65100,stroke-width:2px
    style progress stroke:#2e7d32,stroke-width:2px
    style oncejs stroke:#c62828,stroke-width:2px
    style afkjs stroke:#c62828,stroke-width:2px
    style plan1a stroke:#1565c0,stroke-width:2px
```

---

## 8. Delivery Paths — PR Flow with Epic Branches

All tickets are delivered via PR. The target branch depends on whether the ticket has a parent.

```mermaid
flowchart LR
    Claude["Claude commits code"] --> Push["Push feature branch"]
    Push --> PR["Create PR/MR"]

    PR --> Target{"PR target?"}

    Target -->|"Has parent"| EpicBranch["PR targets\nepic branch"]
    Target -->|"No parent"| BaseBranch["PR targets\nbase branch"]

    subgraph ChildFlow["Child Ticket Flow"]
        EpicBranch --> Review1["Reviewer reviews\nchild PR"]
        Review1 --> Rework1{"Feedback?"}
        Rework1 -->|Yes| Fix1["Rework fixes\npushed"]
        Fix1 --> Review1
        Rework1 -->|No| Merge1["Merge into\nepic branch"]
        Merge1 --> EpicCheck{"All children\ndone?"}
        EpicCheck -->|No| Done1["Log: PR_CREATED\n(more children remain)"]
        EpicCheck -->|Yes| EpicPR["Create epic PR\nepic → base branch"]
        EpicPR --> Review2["Reviewer reviews\ncomplete feature"]
        Review2 --> Done2["Merge epic PR\n→ Done"]
    end

    subgraph StandaloneFlow["Standalone Ticket Flow"]
        BaseBranch --> Review3["Reviewer reviews PR"]
        Review3 --> Rework2{"Feedback?"}
        Rework2 -->|Yes| Fix2["Rework fixes\npushed"]
        Fix2 --> Review3
        Rework2 -->|No| Done3["Merge PR\n→ Done"]
    end

    style ChildFlow stroke:#1565c0,stroke-width:2px
    style StandaloneFlow stroke:#2e7d32,stroke-width:2px
```

---

## 9. Prompt Building — What Claude Receives

The complete prompt structure for implementation and rework.

```mermaid
graph TD
    subgraph "Implementation Prompt"
        Header["You are implementing {ticket}"]
        Context["Ticket: key, title, description\nEpic/Parent | Blockers"]
        Exec["Step 0: Executability check\n(skip if not code work)"]
        TDD{"CLANCY_TDD\nenabled?"}
        TDD -->|Yes| TDDBlock["## TDD\nRed-green-refactor cycle"]
        TDD -->|No| Steps
        TDDBlock --> Steps
        Steps["1. Read .clancy/docs/\n2. Follow GIT.md\n3. Implement fully\n4. Commit\n5. Confirm done"]
    end

    subgraph "Rework Prompt"
        RHeader["You are fixing feedback on {ticket}"]
        RContext["Description + previous diff"]
        RFeedback["## Reviewer Feedback\n1. Issue A\n2. Issue B"]
        RTDD{"CLANCY_TDD?"}
        RTDD -->|Yes| RTDDBlock["## TDD"]
        RTDD -->|No| RSteps
        RTDDBlock --> RSteps
        RSteps["1. Read docs\n2. Follow GIT.md\n3. Fix feedback only\n4. Commit\n5. Confirm done"]
    end

    Header --> Context --> Exec --> TDD
    RHeader --> RContext --> RFeedback --> RTDD

    style TDDBlock stroke:#1565c0,stroke-width:2px
    style RTDDBlock stroke:#1565c0,stroke-width:2px
```

---

## 10. Planner Flow — Plan to Approval

The optional planning phase. Runs per-ticket after the strategist creates them.

```mermaid
flowchart TD
    Start(["/clancy:plan\n(or --from <brief>)"]) --> Mode{"--from\n<brief>?"}

    Mode -->|No — board path| Preflight["Preflight\n(.clancy/.env, board credentials)"]
    Mode -->|Yes — local path| LocalPreflight["Preflight\n(.clancy/.env, brief file exists)"]

    Preflight --> Fetch["Fetch next unplanned ticket\nfrom board queue"]
    Fetch -->|None| Done(["No tickets to plan"])
    Fetch -->|Found| AutoDetect

    LocalPreflight --> LoadBrief["Read brief file"]
    LoadBrief --> AutoDetect

    AutoDetect{"Existing plan?"}
    AutoDetect -->|No| Research
    AutoDetect -->|"Yes + feedback"| Revise["Revise plan\nwith feedback"]
    AutoDetect -->|"Yes, no feedback"| AlreadyPlanned["Already planned.\nAdd feedback to revise."]

    Research["Research codebase\n(read .clancy/docs/,\nexplore affected areas)"] --> Generate
    Revise --> Generate

    Generate["Generate implementation plan\n(steps, file changes,\ntest strategy, size estimate)"] --> Output

    Output{"Output target"}
    Output -->|Board path| PostBoard["Post plan as comment on ticket"]
    Output -->|Local path| WriteFile["Write .clancy/plans/{plan-id}.md"]

    PostBoard --> Display["Display plan to user"]
    WriteFile --> Display
    Display --> Log["Log: PLAN entry\nin progress.txt"]
    Log --> NextSteps(["Review → /clancy:approve-plan\nRevise → comment/file + re-run\nRestart → /clancy:plan --fresh"])

    style AlreadyPlanned stroke:#f9a825,stroke-width:2px
    style Done stroke:#f9a825,stroke-width:2px
```

### Approve-plan flow

`/clancy:approve-plan` resolves its target in one of two shapes. When given a board ticket key it runs the board-transport flow (label swap, optional status transition). When given a plan-file stem (or path) it writes a sibling `.approved` marker file containing the SHA-256 of the plan file and an `approved_at` timestamp. That marker is the **gate** `/clancy:implement --from` checks before applying any plan.

```mermaid
flowchart TD
    Approve(["/clancy:approve-plan {target}"]) --> Resolve{"Target shape?"}

    Resolve -->|Ticket key| BoardPath["Load plan from ticket comments"]
    Resolve -->|Plan-file stem or path| LocalPath["Read .clancy/plans/{stem}.md"]

    BoardPath --> ConfirmB{"User confirms?"}
    ConfirmB -->|"Y"| TransitionB["Swap labels: − clancy:plan + clancy:build\nOptional status transition (CLANCY_STATUS_PLANNED)"]
    ConfirmB -->|"N"| StopB(["Aborted"])
    TransitionB --> LogB["Log: APPROVE_PLAN\nin progress.txt"]
    LogB --> ReadyB(["Ticket in build queue"])

    LocalPath --> HashFile["Compute SHA-256 of plan file"]
    HashFile --> OpenExcl["Open .clancy/plans/{stem}.approved\nwith O_EXCL (exclusive create)"]
    OpenExcl -->|"Success"| WriteMarker["Write marker body:\nsha256={hash}\napproved_at={iso-timestamp}"]
    OpenExcl -->|"EEXIST"| Existing{"Re-run\nwith --push?"}
    Existing -->|"No (default)"| AlreadyApproved["Already approved — stop.\n(Marker preserved byte-for-byte.)"]
    Existing -->|"Yes"| PushFallthrough["Skip Step 4a/4b,\nrun board push retry"]
    WriteMarker --> LogL["Log: APPROVE_PLAN\nin progress.txt"]
    LogL --> ReadyL(["Plan ready for\n/clancy:implement --from\n(consumer verifies hash)"])

    style StopB stroke:#c62828,stroke-width:2px
    style AlreadyApproved stroke:#f9a825,stroke-width:2px
    style PushFallthrough stroke:#1565c0,stroke-width:2px
    style WriteMarker stroke:#1565c0,stroke-width:2px
```

Hash comparison happens in the **consumer** (`/clancy:implement --from`), not in `/clancy:approve-plan`. Approve is write-once via `O_EXCL`; implement reads the marker, re-hashes the plan, and refuses to run on mismatch — the user must delete the marker and re-approve.

---

## 11. Hook Architecture — Events and Hooks

Which hooks fire on which Claude Code events, and what they do.

```mermaid
flowchart TD
    subgraph "Session Lifecycle"
        SessionStart(["SessionStart"]) --> CheckUpdate["clancy-check-update\n• Version check\n• Stale brief detection"]
    end

    subgraph "Every Tool Call"
        PreTool(["PreToolUse"]) --> CredGuard["clancy-credential-guard\n• Block secrets in file writes"]
        PreTool --> BranchGuard["clancy-branch-guard\n• Block force push\n• Block push to main\n• Block destructive resets"]

        PostTool(["PostToolUse"]) --> CtxMonitor["clancy-context-monitor\n• Context % warning (35%/25%)\n• Time guard warning (80%/100%)"]
        PostTool --> DriftDetect["clancy-drift-detector\n• Warn on outdated runtime files"]
    end

    subgraph "UI"
        Statusline(["Statusline"]) --> StatusHook["clancy-statusline\n• Context usage bar\n• Update available banner"]
        NotifEvent(["Notification"]) --> NotifHook["clancy-notification\n• Native OS desktop notifications"]
    end

    subgraph "Context Management"
        PostCompact(["PostCompact"]) --> Compact["clancy-post-compact\n• Re-inject ticket key,\n  branch, description\n  from lock.json"]
    end

    CredGuard -.->|"deny"| Block1(["Tool blocked"])
    BranchGuard -.->|"deny"| Block2(["Tool blocked"])

    style Block1 stroke:#c62828,stroke-width:2px
    style Block2 stroke:#c62828,stroke-width:2px
```

**Key rule:** All hooks are best-effort and fail-open. A crashing hook must never block the user's workflow.

---

## 12. Grill Phase — Human vs AI-Grill

The decision tree inside `/clancy:brief` Step 2a.

```mermaid
flowchart TD
    Start(["Grill Phase"]) --> AfkFlag{"--afk flag\npassed?"}

    AfkFlag -->|Yes| AIGrill
    AfkFlag -->|No| EnvCheck{"CLANCY_MODE\nenv var?"}

    EnvCheck -->|"afk"| AIGrill
    EnvCheck -->|"interactive / unset"| HumanGrill

    subgraph HumanGrill["Human Grill (interactive)"]
        H1["Generate clarifying questions\n(scope, users, constraints,\nedges, dependencies)"]
        H2["For each question:\n• Provide recommended answer\n• User confirms or overrides"]
        H3["User can ask back:\n• What does the codebase do?\n• What's the industry standard?\n• What would you recommend?"]
        H4["Answers spawn follow-ups\n(multi-round, 2-5 rounds)"]
        H5["Continue until zero\nopen questions remain"]

        H1 --> H2 --> H3 --> H4 --> H5
    end

    subgraph AIGrill["AI-Grill (autonomous)"]
        A1["Generate 10-15 questions\n(same categories as human)"]
        A2["Devil's advocate agent\ninterrogates sources:\n• Codebase exploration\n• Board context\n• Web research"]
        A3["Challenge own answers\n— flag conflicts between\nsources"]
        A4["Self-follow-ups within\nsame pass (single pass)"]
        A5["Classify each answer:\n>80% confident → Discovery\nConflict/unknown → Open Questions"]

        A1 --> A2 --> A3 --> A4 --> A5
    end

    HumanGrill --> Output
    AIGrill --> Output

    Output["## Discovery\nQ&A with source tags:\n(human/codebase/board/web)\n\n## Open Questions\nUnresolvable items for PO"]

    style HumanGrill stroke:#1565c0,stroke-width:2px
    style AIGrill stroke:#2e7d32,stroke-width:2px
```

---

## 13. Build Pipeline

How packages are built and published.

```mermaid
flowchart LR
    subgraph Build["pnpm build (Turbo)"]
        CoreBuild["@chief-clancy/core\ntsc + tsc-alias"] --> TermBuild["@chief-clancy/terminal\ntsc + tsc-alias\n+ esbuild hooks"]
    end

    subgraph Publish["Changesets"]
        Changeset["pnpm changeset\n(create .md file)"] --> Version["changeset version\n(bump versions)"]
        Version --> GroupCL["group-changelog.ts\n(gitmoji headers)"]
        GroupCL --> VersionPR["Version PR\n(auto-created)"]
        VersionPR --> Merge["Merge PR"]
        Merge --> NPM["changeset publish\n→ npm registry"]
    end

    Build --> Publish

    style Build stroke:#1565c0,stroke-width:2px
    style Publish stroke:#2e7d32,stroke-width:2px
```
