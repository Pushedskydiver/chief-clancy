# Clancy Dev Loop Workflow

## Overview

Autonomous queue-based ticket execution. Fetches ready tickets from the board (up to 50 by default, configurable via `--max=N`, hard cap 100), then processes them sequentially through the implementation pipeline. Each ticket runs the full cycle: fetch, readiness check, implementation, quality gates, PR creation, and delivery.

The dev loop workflow delegates to the `clancy-dev-autopilot.js` bundle:

```bash
node .clancy/clancy-dev-autopilot.js
```

---

## Step 1 — Preflight checks

### 1. Detect installation context

Check for `.clancy/.env`:

- **Absent** → **standalone mode**. No board credentials configured. Stop with:

  ```
  No board credentials found. Run /clancy:board-setup first to configure your board, then re-run /clancy:dev-loop.
  ```

  Stop.

- **Present** → continue to `.clancy/clancy-dev-autopilot.js` check below.

Check for `.clancy/clancy-dev-autopilot.js`:

- **Present** → continue to Step 2.
- **Absent** → the dev autopilot bundle is not installed. Stop with:

  ```
  Dev autopilot bundle not found. Run npx @chief-clancy/dev to install the dev execution surface.
  ```

  Stop.

---

## Step 2 — Execute

Shell to the dev autopilot bundle:

```bash
node .clancy/clancy-dev-autopilot.js
```

Pass through any flags (`--afk`, `--max=N`, `--bypass-readiness`) as additional arguments.

The bundle handles: fetching the ticket queue from the board, sequentially executing each ticket through the pipeline, quiet hours pausing, halt conditions (fatal aborts stop the loop), and loop completion reporting.
