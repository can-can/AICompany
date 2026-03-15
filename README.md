# ai-company

Multi-agent AI coordination framework — a global hub managing multiple isolated projects with coordinated Claude Code roles.

## Prerequisites

- **Node.js 18+**
- **Claude Code subscription** (authenticated via `claude login`)

## Install

```bash
npm install -g ai-company
```

## Quick Start

```bash
# Initialize a new project in the current directory
ai-company init

# Start the hub server (runs in background)
ai-company start

# Create a task for a role
ai-company create pm "Build user authentication"

# Open the dashboard
open http://localhost:4000
```

## CLI Commands

### Hub

| Command | Description |
|---------|-------------|
| `ai-company start` | Start the hub server (background, port 4000) |
| `ai-company stop` | Stop the hub server |
| `ai-company health` | Check hub status |

### Projects

| Command | Description |
|---------|-------------|
| `ai-company init [dir]` | Initialize a new project (interactive) |
| `ai-company register [dir]` | Register an existing project directory |
| `ai-company unregister <name\|dir>` | Remove a project from the hub |
| `ai-company list` | List all registered projects |

### Tasks

| Command | Description |
|---------|-------------|
| `ai-company create <role> <title>` | Create a new task for a role |
| `ai-company tasks [role]` | List tasks (optionally filtered by role) |
| `ai-company status` | Show role status for the current project |
| `ai-company next-id` | Reserve the next unique task ID |
| `ai-company send <role> "message"` | Send human input to a waiting role |

### Options

- `--project <name>` — target a specific project from any directory

## Dashboard

The web dashboard at `http://localhost:4000` shows real-time project status, role states, task lists, and activity logs.

## How It Works

Each project has **roles** (e.g. pm, engineer, qa) that are coordinated via **task files** in a shared `tasks/` directory. The hub watches for file changes and automatically dispatches work to the appropriate Claude Code agent for each role. Roles communicate by creating task files addressed to other roles.
