# AI Company npm Distribution Design

## Goal

Transform the AI Company system from a per-project `bin/` setup into a globally installed npm package (`ai-company`) that manages multiple isolated projects from a single hub server and dashboard.

## Architecture

```
npm install -g ai-company
        │
        ▼
ai-company CLI  ←──── ~/.ai-company/projects.json  (registry)
        │                    ~/.ai-company/.server-pid
        ▼
Hub Server :4000
┌─────────────────────────────────────┐
│  FileWatcher  × N projects          │
│  RoleManager  × N projects          │
│  SDKRunner    (shared, stateless)   │
│  Web Dashboard (all projects)       │
└─────────────────────────────────────┘
        │
┌───────┼───────┐
▼       ▼       ▼
Project A   Project B   Project C
tasks/      tasks/      tasks/
roles/      roles/      roles/
company.md  company.md  company.md
```

**Key principles:**
- Each project keeps its own `tasks/`, `roles/`, `company.md` — full isolation, agents read their project's context
- The hub runs once globally, manages all registered projects
- Projects no longer carry a `bin/` directory — all code lives in the npm package
- `~/.ai-company/` stores state only (registry + PID), never code

## npm Package Structure

```
ai-company/                     ← npm package
  package.json                  (bin: { "ai-company": "bin/ai-company.js" })
  bin/
    ai-company.js               ← global CLI entry point
    company-server.js           ← hub server
    lib/
      role-manager.js
      sdk-runner.js
      file-watcher.js
      web-server.js
      task-parser.js
      project-registry.js       ← NEW: read/write ~/.ai-company/projects.json
    dashboard/
      index.html                ← updated multi-project dashboard
  roles/                        ← role templates (copied on init)
    pm.md
    engineer.md
    qa.md
    ceo.md
    designer.md
    ops.md
    marketing.md
    sales.md
  memories/                     ← memory templates (copied on init)
    pm.md
    engineer.md
    qa.md
    ceo.md
    designer.md
    ops.md
    marketing.md
    sales.md
  templates/
    company.md                  ← company.md template (filled on init)
```

## Global State

```
~/.ai-company/
  projects.json       ← [{ "name": "MyApp", "path": "/Users/you/Projects/MyApp" }, ...]
  .server-pid         ← PID of running hub
```

## Project Structure After Init

Projects no longer carry `bin/`. Everything is provided by the global package.

```
my-project/
  company.md
  roles/
    pm/
      CLAUDE.md
      memory.md
    engineer/
      CLAUDE.md
      memory.md
    ...
  tasks/
  logs/
  public/             ← user's app (optional)
```

## CLI Commands

All commands work from any directory. When inside a registered project directory, `--project` is auto-detected from cwd by walking up the directory tree and matching against registered project paths.

**Project resolution failure:** If a task management command is run outside any registered project directory and `--project` is not given, the CLI prints an error and exits:
```
Error: Not inside a registered project directory.
  Use --project <name> or run from inside a project.
  Registered projects: ai-company list
```

```
# Onboarding
ai-company init [dir]               Scaffold project in dir (default: cwd), register it
ai-company register [dir]           Register an existing project
ai-company unregister [dir]         Remove project from registry
ai-company list                     List all registered projects

# Hub lifecycle
ai-company start                    Start global hub server on :4000
ai-company stop                     Stop hub server
ai-company health                   Show hub status and dashboard URL

# Task management (auto-detects project from cwd, or use --project <name>)
ai-company create <role> <title>    Create a task in current project
ai-company tasks [role]             List tasks for current project
ai-company send <role> "message"    Send message to a waiting agent
ai-company status                   Show all roles and task counts
ai-company next-id                  Reserve and print next task ID
```

`--project <name>` flag works on all task management commands to target any project from any directory.

## Hub Server — Multi-Project Management

The hub server (`bin/company-server.js`) is updated to:

1. Read `~/.ai-company/projects.json` on startup
2. For each registered project:
   - If the project path does not exist on disk: log a warning, skip it, and mark it as `offline` in the dashboard. Do not crash or refuse to start.
   - If the path exists, create an isolated:
     - `FileWatcher` watching `project/tasks/`
     - `RoleManager` with its own queue and role states
     - Sessions loaded from `project/roles/.sessions.json`
3. Watch `~/.ai-company/projects.json` for changes (via chokidar) — hot-reload on change:
   - **New project added**: create its FileWatcher + RoleManager and start watching
   - **Project removed**: close its FileWatcher, drain its RoleManager queue (no new dispatches), and remove from the active set. Any agent currently running finishes naturally.
   - **Project path changed**: treat as remove + add
4. Share one `SDKRunner` instance across all projects (it is stateless — just spawns claude processes)
5. Write PID to `~/.ai-company/.server-pid`

**Stale PID file handling:** On `ai-company start`, if `.server-pid` exists:
- Check if the PID is alive (`kill -0 <pid>`). If alive: print "Server already running (PID X)" and exit.
- If the PID is dead (stale file from a crash): log a warning, remove the stale file, and start normally.

Per-project isolation guarantees:
- Role queues and states are independent per project
- Logs written to `project/logs/`
- Sessions stored at `project/roles/.sessions.json`
- Task counter at `project/tasks/.next-id`

## Web Dashboard

Single dashboard at `http://localhost:4000` showing all projects.

**Layout:**
```
┌──────────────┬──────────────────────────────────┐
│  Projects    │  MyApp                           │
│  ─────────   │  ┌─────┬──────────┬───────┐      │
│  ● MyApp     │  │ pm  │ engineer │  qa   │      │
│  ● BlogBot   │  │free │ working  │ free  │      │
│  ○ Archive   │  └─────┴──────────┴───────┘      │
│              │                                  │
│              │  Tasks (12)    Logs              │
│              │  [task table...]                 │
└──────────────┴──────────────────────────────────┘
```

- **Project sidebar**: lists all registered projects; dot indicator if any role is active
- **Role cards**: color-coded (green=free, orange=working, red=waiting_human), scoped to selected project
- **`waiting_human` alert**: red banner identifies which project+role needs human input (e.g. "MyApp › qa is waiting")
- **Tasks / Logs tabs**: per-project, same behavior as today
- **API routes and response shapes:**

```
GET /api/projects
→ [{ name, path, status: "active"|"offline" }]

GET /api/status?project=<name>
→ { project: name, roles: { <role>: { state: "free"|"working"|"waiting_human"|"ready", queueDepth: N } } }

GET /api/tasks?project=<name>
→ [{ id, title, from, to, owner, status, priority, created, updated }]

GET /api/logs?project=<name>&limit=50
→ [{ level: "info"|"warn"|"error", role: <name>|null, message, timestamp }]

POST /api/next-id?project=<name>
→ { id: "007" }   ← reserves and returns next task ID (increments tasks/.next-id)
```

## `ai-company init` Flow

```
$ ai-company init

Project name: MyApp
Goal (one sentence): Build a task management web app
Roles: pm, engineer, qa (comma-separated, press enter for default)

Creating project structure...
  ✓ company.md
  ✓ roles/pm/CLAUDE.md + memory.md
  ✓ roles/engineer/CLAUDE.md + memory.md
  ✓ roles/qa/CLAUDE.md + memory.md
  ✓ tasks/
  ✓ logs/

Registering project...
  ✓ Added to ~/.ai-company/projects.json

Hub is running — project loaded automatically.
Dashboard: http://localhost:4000

Next: ai-company create pm "your first goal"
```

If the hub is already running when `init` or `register` is called, the CLI writes to `~/.ai-company/projects.json`, and the hub's chokidar watcher on that file detects the change and hot-reloads the new project automatically. No signal or HTTP call is needed — the file-watch is the notification mechanism.

## Startup Auth Check

On `ai-company start`, before launching the server:

```
Checking Claude Code authentication...
✗ Not authenticated with Claude Code.
  Run: claude login
  Then: ai-company start
```

The Claude Agent SDK bundles Claude Code CLI internally — no separate `claude` CLI installation required. The only prerequisite is a Claude Code subscription with active authentication (credentials stored in `~/.claude/`).

## Distribution

```bash
npm install -g ai-company
```

**Prerequisites:**
- Node.js 18+
- Claude Code subscription (authenticated — credentials in `~/.claude/`)

The `@anthropic-ai/claude-agent-sdk` dependency bundles Claude Code CLI internally. No separate `claude` binary installation is needed.

**Future distribution** (when targeting non-Claude-Code users): compile to platform binary via Bun + distribute via Homebrew. Out of scope for this iteration.

## What Changes in Existing Projects

Existing projects (like the current `AICompany/`) can be migrated:

1. `npm install -g ai-company`
2. `ai-company register` (from inside the project directory)
3. Remove `bin/` from the project (now provided by the global package)
4. Use `ai-company start` instead of `./bin/company start`

The `tasks/`, `roles/`, `company.md`, and `logs/` directories are unchanged.
