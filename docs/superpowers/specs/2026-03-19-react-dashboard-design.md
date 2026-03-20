# React Dashboard with assistant-ui — Design Spec

## Overview

Replace the single-file HTML dashboard (`bin/dashboard/index.html`) with a React app using [assistant-ui](https://www.assistant-ui.com/) for AI chat components. The goal is a proper conversation experience when interacting with AI agent roles (PM, Engineer, QA).

## Architecture

### Stack
- **Vite** — build tool and dev server
- **React** + **React Router** — SPA with client-side routing
- **assistant-ui** (`@assistant-ui/react`) — composable AI chat primitives
- **Tailwind CSS** + **shadcn/ui** — styling (light theme)
- **Vitest** — unit tests

### Directory Structure

```
ai-company/
├── bin/                          # Existing backend — minimal changes
│   ├── lib/
│   │   ├── web-server.js         # Modified: serve dashboard/dist, SPA fallback
│   │   ├── role-manager.js       # Already has conversationHistory (no changes)
│   │   └── ...
│   └── dashboard/
│       └── index.html            # DELETED
│
├── dashboard/                    # NEW — Vite + React app
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── lib/
│   │   │   ├── api.ts            # fetch wrappers for /api/* endpoints
│   │   │   └── useAICompanyRuntime.ts  # custom assistant-ui runtime
│   │   ├── views/
│   │   │   ├── ProjectListView.tsx
│   │   │   ├── DashboardView.tsx
│   │   │   └── ChatView.tsx
│   │   └── components/
│   │       ├── RoleCard.tsx
│   │       ├── TaskTable.tsx
│   │       ├── LogFeed.tsx
│   │       ├── RoleSidebar.tsx
│   │       └── ChatThread.tsx
│   ├── dist/                     # Build output
│   └── __tests__/
│       ├── api.test.ts
│       └── useAICompanyRuntime.test.ts
│
├── package.json                  # Root — adds build:dashboard script
└── ...
```

### Process Model

Single process in production — Express serves both `/api/*` routes and the built React app from `dashboard/dist/`. In development, Vite dev server on port 5173 proxies `/api/*` to Express on port 4000.

### Vite Dev Proxy

`vite.config.ts` must include:
```ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
})
```

## Views & Routing

### `/` — Project List
- Cards for each registered project with status indicator (active/offline)
- Offline projects shown with greyed-out card and "Offline" badge — still clickable but dashboard shows an offline message
- Click a project to enter its dashboard
- Data source: `GET /api/projects` returns `[{ name, path, status }]` where `status` is `"active"` or `"offline"`

### `/:project` — Project Dashboard
- Header: "AI Company" with breadcrumb (All Projects > ProjectName)
- Role cards row: one card per role showing state (free/working/waiting/ready), active task (#ID + title), queue depth
- Clicking a role card navigates to `/:project/chat/:role`
- Waiting roles get a red border and pulsing indicator
- Tasks table: ID, title, from, to, owner, status, priority (with colored badges)
- Log feed: timestamped entries at the bottom
- **Offline handling:** if `/api/status` returns 503, show "Project is offline" message instead of role cards/tasks/logs

### `/:project/chat/:role` — Chat View (Full Screen)
- Left sidebar: narrow strip with role icons (PM, ENG, QA), active role highlighted with blue accent, clicking another switches chat
- Header: breadcrumb (All Projects > ProjectName > Role), active task info
- Main area: assistant-ui `Thread` component showing conversation history
- Input: assistant-ui `Composer` component (textarea + send button)
- Agent messages on the left, human messages on the right
- Input disabled with status message based on role state:
  - `waiting_human` → input enabled
  - `working` → disabled, "Agent is working..."
  - `free` → disabled, "Agent is idle — no active task"
  - `ready` → disabled, "Agent is finishing up..." (transient state between SDK runs)

### Role State → UI Mapping

| State | Card border color | Card label | Composer enabled |
|---|---|---|---|
| `free` | green `#1a7f37` | "free" | No |
| `working` | amber `#bf8700` | "working" | No |
| `waiting_human` | red `#cf222e` | "waiting" | Yes |
| `ready` | green `#1a7f37` | "ready" | No |

## assistant-ui Integration

### Custom Runtime Adapter (`useAICompanyRuntime`)

assistant-ui requires a runtime to connect its UI components to a backend. We implement a custom one since we're polling, not streaming.

**Responsibilities:**
- Polls `/api/status?project=X` every 3 seconds
- Reads `conversationHistory` array from the role's status
- Converts `{from: 'agent'|'human', text, timestamp}` entries into assistant-ui message format
- On send: POSTs to `/api/send?project=X` with `{role, message}`, triggers immediate re-poll
- Exposes conversation as a `ThreadRuntime` consumed by `<Thread>` and `<Composer>`

### Components Used

| assistant-ui component | Usage |
|---|---|
| `ThreadPrimitive.Root` | Chat container |
| `ThreadPrimitive.Messages` | Message list with auto-scroll |
| `MessagePrimitive.Root` | Individual message bubble |
| `ComposerPrimitive.Root` | Input area |
| `ComposerPrimitive.Input` | Textarea |
| `ComposerPrimitive.Send` | Send button |

### What We Don't Use
- No streaming adapters (polling-based)
- No tool UI / generative UI (agents don't expose tools to the user)
- No AI SDK runtime (custom backend)

The value: auto-scrolling, markdown rendering, accessible keyboard handling, composable styled primitives — all out of the box.

## Styling & Theme

- **Light theme** — white/light gray backgrounds (`#ffffff`, `#f6f8fa`), dark text (`#1f2328`)
- Based on shadcn/ui default light theme
- Status colors: green `#1a7f37` (free), red `#cf222e` (waiting), amber `#bf8700` (working), blue `#0969da` (active/selected)
- No custom CSS files — Tailwind utility classes + shadcn/ui theme variables only

## Backend Changes

### `web-server.js`

`__dirname` in `web-server.js` resolves to `bin/lib/`. Path calculations walk up from there.

- Remove: `express.static(join(__dirname, '../dashboard'))` (old `bin/dashboard/`)
- Remove: `app.get('/', (req, res) => res.redirect('/dashboard'))` (SPA catch-all replaces this)
- Add: `express.static(join(__dirname, '..', '..', 'dashboard', 'dist'))` (project root → `dashboard/dist/`)
- Add: SPA fallback as the **last route** — any non-`/api/*` GET route serves `index.html`

**Middleware ordering (critical):**
1. `express.json()` (existing)
2. `express.static(...)` for `dashboard/dist/` (new)
3. All `/api/*` route handlers (existing)
4. SPA catch-all: `app.get('*', (req, res) => res.sendFile(...))` (new, must be last)

### `bin/dashboard/` directory
- Delete entirely (the directory and `index.html`)

### Root `package.json`
- Add script: `"build:dashboard": "cd dashboard && npm run build"`
- Add script: `"dev:dashboard": "cd dashboard && npm run dev"`
- Add `"dashboard/"` to `"files"` array (so `dashboard/dist/` is available when package is installed globally)

### No changes to:
- role-manager.js (conversationHistory already added)
- sdk-runner.js
- company-server.js
- file-watcher.js
- task-parser.js
- project-registry.js

## Data Flow

### Polling cycle (every 3s)
```
React App → GET /api/status?project=X → Express → roleManager.getStatus()
         → Returns { roles: { pm: { state, activeTask, conversationHistory, ... }, ... } }
         → Runtime adapter converts to assistant-ui messages
         → Thread component re-renders
```

### Sending a message
```
User types in Composer → POST /api/send?project=X { role, message }
                       → Express → roleManager.sendInput(role, message)
                       → message pushed to conversationHistory + inputQueue
                       → Immediate re-poll updates the UI
                       → Agent picks up input, processes, adds response to conversationHistory
                       → Next poll shows agent response
```

## Testing

### Existing tests — unchanged
- `role-manager.test.js` — backend logic
- `web-server.test.js` — API endpoints

### New tests (Vitest)
- `api.test.ts` — mock fetch, verify API wrapper functions
- `useAICompanyRuntime.test.ts` — mock fetch, verify polling behavior and message format conversion

### Test Cases

**`api.test.ts`:**
- `fetchProjects()` returns parsed project list
- `fetchStatus(project)` returns role status data
- `fetchStatus()` returns `null` for offline projects (503 responses)
- `sendMessage(project, role, message)` posts correctly and returns ok
- `sendMessage()` handles error responses

**`useAICompanyRuntime.test.ts`:**
- Polls `/api/status` on mount and converts `conversationHistory` to assistant-ui messages
- Maps `{from: 'agent'}` to assistant messages and `{from: 'human'}` to user messages
- Triggers immediate re-poll after `sendMessage`
- Disables composer when role state is not `waiting_human`
- Handles empty conversation history gracefully

### No e2e tests in this phase
The React app is a thin UI over a tested REST API. Playwright can be added later.

## Known Limitations

- **Conversation history is in-memory only.** Restarting the server (`ai-company stop && ai-company start`) clears all conversation history. Persistence is out of scope for this phase.

## Dev Workflow

```bash
# Terminal 1: Start the backend
ai-company start

# Terminal 2: Start the frontend dev server
cd dashboard && npm run dev
# Open http://localhost:5173

# Production build
npm run build:dashboard
# Dashboard served from http://localhost:4000
```
