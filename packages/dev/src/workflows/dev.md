# Clancy Dev Workflow

## Overview

Autonomous single-ticket execution. Takes a board ticket key, runs the implementation pipeline, and delivers the result.

The dev workflow delegates to the `clancy-dev.js` bundle:

```bash
node .clancy/clancy-dev.js {ticket}
```

---

## Step 1 — Preflight checks

### 1. Detect installation context

Check for `.clancy/.env`:

- **Absent** → **standalone mode**. No board credentials configured. Stop with:

  ```
  No board credentials found. Install @chief-clancy/brief or @chief-clancy/plan and run /clancy:board-setup first, then re-run /clancy:dev.
  ```

  Stop.

- **Present** → continue to `.clancy/clancy-dev.js` check below.

Check for `.clancy/clancy-dev.js`:

- **Present** → continue to Step 2.
- **Absent** → the dev bundle is not installed. Stop with:

  ```
  Dev bundle not found. Run npx @chief-clancy/dev to install the dev execution surface.
  ```

  Stop.

---

## Step 2 — Execute

Shell to the dev bundle:

```bash
node .clancy/clancy-dev.js {ticket}
```

Pass through any flags (`--bypass-readiness`, `--afk`) as additional arguments.

The bundle handles all pipeline phases: fetch ticket, readiness check, implementation, quality gates, PR creation, and delivery.
