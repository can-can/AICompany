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

## Task Flow

1. Creator sets `to: <role>`, `from: <me>`, `status: pending`
2. Assignee picks up: `owner: <me>`, `status: in_progress`
3. Assignee finishes: `status: done` (or `rejected` with reason)
