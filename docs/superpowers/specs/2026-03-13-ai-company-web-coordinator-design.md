# AI Company — Web Coordinator Design

**Date:** 2026-03-13
**Status:** Approved
**Scope:** Replace bash daemon with Node.js coordinator; add read-only web dashboard

---

## Overview

Replace the bash-based daemon and tmux agent management with a Node.js coordinator that uses the Claude Agent SDK for reliable agent invocation and idle detection. Add a read-only web dashboard for monitoring task and role status.

---

## Problem Statement

The existing `company-daemon` (bash) has four fundamental reliability problems:

1. **Polling** — 3-second poll interval misses rapid state changes and introduces race conditions
2. **Bash fragility** — process management, error handling, and state tracking in bash are brittle
3. **Tmux dependency** — `send-keys` can silently fail if the window isn't in the right state
4. **No true idle detection** — task file status is self-reported by agents; the coordinator cannot know if an agent is genuinely idle or just hasn't updated its task file yet

---

## Solution

A single Node.js process (`bin/company-server`) replaces the daemon entirely. It uses:

- **`chokidar`** on `tasks/` for real-time file change events (uses native FSEvents on macOS, handles debouncing and edge cases internally)
- **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) to invoke agents programmatically — `sdk.query()` is the authoritative idle signal
- **Per-role state machine** with 4 states and a serialized dispatch queue to enforce one-task-at-a-time dispatch with no races
- **HTTP server** on port 4000 (using `express`) serving a read-only web dashboard

Task markdown files and YAML frontmatter remain unchanged. Role CLAUDE.md files require no changes.

---

## Architecture

### Components

| Component | Status | Description |
|-----------|--------|-------------|
| `bin/company-server` | NEW | Node.js coordinator + web server (replaces daemon) |
| `bin/dashboard/index.html` | NEW | Read-only web dashboard |
| `package.json` | NEW | Dependencies: `@anthropic-ai/claude-agent-sdk`, `express`, `chokidar` |
| `roles/.sessions.json` | NEW | Persists role session_ids across server restarts |
| `bin/company` | UPDATED | `start`/`stop` target `company-server`; adds `send` command |
| `bin/lib/parse-frontmatter.sh` | KEPT | Used by `company` CLI bash commands |
| `bin/company-daemon` | DELETED | Replaced by `company-server` |
| `bin/lib/tmux-helpers.sh` | DELETED | No longer needed |
| `tasks/*.md` | UNCHANGED | Same markdown + YAML frontmatter format |
| `roles/*/CLAUDE.md` | UNCHANGED | No changes required |
| `company.md` | UNCHANGED | Shared context file |

### company-server Internals

Three logical modules inside one Node.js process:

**1. File Watcher**
- `chokidar` watching `tasks/` directory (`chokidar.watch('tasks/*.md', { ignoreInitial: false })`)
- `ignoreInitial: false` means chokidar emits an `add` event for each existing file on startup — queues are rebuilt automatically before watch events begin, no separate scan needed
- On `add`/`change` event: parse frontmatter, update role queue, call `scheduleDispatch(role)`
- chokidar handles FSEvents debouncing, duplicate events, and macOS quirks internally

**2. Role Manager**
- One runner object per configured role
- In-memory task queue per role (sorted by priority then created date)
- Per-role dispatch serialization: a boolean `sdkInFlight` flag plus an async `dispatchChain` promise to prevent concurrent dispatch calls on the same role (see Dispatch Logic)
- State machine: `free` / `working` / `waiting_human` / `ready`
- Session IDs loaded from `roles/.sessions.json` on startup; written back whenever a new SDK session is created

**3. Web Server**
- `express` HTTP server on port 4000
- Serves static `bin/dashboard/index.html` at `GET /`
- Four JSON API endpoints (see Web Dashboard section)
- In-memory log ring buffer: 500 entries max, evicts oldest on overflow

### Dependencies

- `@anthropic-ai/claude-agent-sdk` — programmatic agent control
- `express` — web server
- `chokidar` — reliable file watching (uses native FSEvents on macOS, 1 dependency)

---

## Role State Machine

Each role has exactly one state at any time:

| State | Condition | Dashboard color | Action |
|-------|-----------|-----------------|--------|
| `free` | No active task, SDK not in flight | Green | Dispatch next from queue if available |
| `working` | `sdk.query()` in flight | Orange | Do nothing, wait for SDK to return |
| `waiting_human` | SDK returned BUT task still `in_progress` | Red | Alert dashboard; await `company send` or task file update |
| `ready` | SDK returned AND task is `done` or `rejected` | Green | Immediately dispatch next from queue |

### State Transitions

```
free + task in queue              → pop task, sdk.query() → working
working + sdk returns + task done/rejected  → ready
working + sdk returns + task in_progress    → waiting_human  (⚠ alert)
ready + task in queue             → pop task, sdk.query() → working
ready + queue empty               → free
waiting_human + task file updated to done/rejected → ready → dispatch next
waiting_human + human runs `company send <role> "msg"` → sdk.query() again → working
```

### Human Input Path for waiting_human

When a role is `waiting_human`, the human has two options:

1. **Update the task file** — edit `tasks/<id>-<slug>.md` directly (e.g. add a clarification in the body, or change status to `done`). The file watcher detects the change and calls `tryDispatch(role)`, which re-evaluates state.

2. **CLI send command** — `company send <role> "your message"`. This appends a `## Human Input` section to the role's current task file (triggering fs.watch) and calls `sdk.query()` with a prompt that includes the new message, resuming the agent in the same session.

### Dispatch Logic

Each role runner has a `dispatchChain` promise (initially `Promise.resolve()`) that serializes all dispatch calls for that role, preventing concurrent execution:

```javascript
function scheduleDispatch(role) {
  const runner = roles[role]
  runner.dispatchChain = runner.dispatchChain.then(() => tryDispatch(role))
}

async function tryDispatch(role) {
  const runner = roles[role]
  if (runner.sdkInFlight) return           // working — do nothing

  const currentTask = runner.currentTask
  if (currentTask) {
    const fresh = readTaskFile(currentTask.filepath)  // always re-read from disk
    if (fresh && fresh.status === 'in_progress') {
      runner.state = 'waiting_human'        // alert dashboard
      return
    }
  }

  const next = runner.queue.shift()
  if (!next) { runner.state = 'free'; return }

  runner.state = 'working'
  runner.sdkInFlight = true
  runner.currentTask = next
  try {
    await sdk.query(buildPrompt(next, role), { session_id: runner.sessionId })
  } finally {
    runner.sdkInFlight = false
    runner.currentTask = readTaskFile(next.filepath)  // re-read real status
    scheduleDispatch(role)                             // chain next dispatch
  }
}
```

**`readTaskFile(filepath)`** — reads the `.md` file at the given path, parses YAML frontmatter, and returns a task object `{ id, title, status, from, to, owner, priority, created, filepath }`. Returns `null` if the file does not exist. Never throws; returns `null` on parse errors.

**`buildPrompt(task, role)`** — constructs the prompt string passed to `sdk.query()`. Includes:
1. The full contents of `tasks/<task-file>.md`
2. The contents of `roles/<role>/CLAUDE.md`
3. The contents of `company.md`
4. Instruction: "You are the `<role>`. Read the task above and complete it. Update the task file status when done."

### Queue Rules

- Tasks enter queue sorted by `priority` (high → medium → low) then `created` date (ascending)
- Queue holds only tasks with `status: pending` and `to: <this role>`
- When a task is `rejected`, the task file changes → `fs.watch` fires → `scheduleDispatch(from_role)` is called naturally for the `from` role — no special notification path needed
- Queue is rebuilt on server start by scanning all `tasks/*.md` files before watch events begin

### Session Continuity

- On startup: load `roles/.sessions.json` (format: `{ "engineer": "sess_abc123", "pm": "sess_def456", ... }`). If the file is missing or a role has no entry, the first `sdk.query()` call for that role will generate a new session_id.
- After each `sdk.query()` call: if the returned `ResultMessage.session_id` differs from the stored value, update `roles/.sessions.json`.
- On server restart: session_ids are preserved, so agents resume with full prior context.

---

## Web Dashboard

**URL:** `http://localhost:4000`
**Update mechanism:** JavaScript polls `/api/status` and `/api/tasks` every 3 seconds.

Note: 3-second polling is intentional for a read-only display — display latency is not critical, and polling keeps the dashboard implementation simple with no WebSocket dependency.

### Layout

1. **Alert banner** (top, red) — shown when any role is `waiting_human`. Lists the role name and active task title. Hidden when no role is waiting.
2. **Role cards** — one card per role showing: state (color-coded), active task ID + title, queue depth.
3. **Task table** — all tasks with columns: ID, Title, From, To, Status, Priority. Rows with `waiting_human` task highlighted red.
4. **Log tail** — last 50 log entries from the server's in-memory ring buffer.

### API Endpoints

| Endpoint | Response schema |
|----------|-----------------|
| `GET /` | Dashboard HTML (static file) |
| `GET /api/status` | `{ roles: { [roleName]: { state, activeTask: {id, title} \| null, queueDepth } } }` |
| `GET /api/tasks` | `{ tasks: [{ id, title, from, to, owner, status, priority, created, updated }] }` |
| `GET /api/logs` | `{ logs: [{ timestamp: ISO8601, level: "info"\|"warn"\|"error", role: string\|null, message: string }] }` — last 50 entries |

### Log Storage

- In-memory ring buffer of 500 log entries (evicts oldest on overflow)
- Schema per entry: `{ timestamp: ISO8601 string, level: "info"|"warn"|"error", role: string|null, message: string }`
- Logs are reset on server restart (not persisted to disk)
- `/api/logs` returns the most recent 50 entries

---

## Lifecycle Changes

### company start (before)
```
tmux new-session → launch claude in N windows → nohup company-daemon
```

### company start (after)
```
node bin/company-server &
```

Agents are launched on-demand by the server when tasks arrive. No tmux sessions created at startup.

### New CLI Command

```
company send <role> "message"
```

Appends a `## Human Input` section with the message to the role's current in-progress task file, then calls `tryDispatch(role)` via an internal signal to the running server (or by the file watcher detecting the task file change).

---

## What Is Not In Scope

- Create/update tasks via the web UI (dashboard is read-only)
- Real-time agent output streaming to the dashboard
- Authentication on the web dashboard
- Remote access (localhost only)
- Persisting logs across server restarts
