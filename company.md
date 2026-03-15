# Company Memory

Shared context for all roles.

## Project

AI Company Demo — building a simple web app with coordinated AI roles.

## Workflow

```
human → pm → engineer (build)
          → qa (test)
```

## Company Conventions

- Tasks live in `tasks/` — single source of truth
- One file per task: `<id>-<slug>.md`
- Tasks use YAML frontmatter: id, from, to, owner, status, priority, created, updated, title
- Status flow: `pending → in_progress → done` (or `rejected`)
- The server watches `tasks/` and auto-routes work to roles

## Task ID Generation

**Always** use the CLI to get a unique task ID — never invent one yourself:

```bash
ai-company next-id   # prints e.g. "004", reserves it atomically
```

Call it **once per task** you plan to create. If creating 3 tasks, call it 3 times and collect the IDs before writing any files. IDs are globally unique across all roles and sessions.

## Task Flow

1. Creator sets `to: <role>`, `from: <me>`, `status: pending`
2. Assignee picks up: `owner: <me>`, `status: in_progress`
3. Assignee finishes: `status: done` (or `rejected` with reason)
