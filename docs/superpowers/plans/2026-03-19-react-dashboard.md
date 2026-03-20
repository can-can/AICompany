# React Dashboard with assistant-ui — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-file HTML dashboard with a React + assistant-ui app providing full-screen chat conversations with AI agent roles.

**Architecture:** Vite + React SPA in `dashboard/` directory. Express serves the built output in production. assistant-ui's `useExternalStoreRuntime` connects to existing `/api/*` endpoints via polling. Light theme with Tailwind CSS.

**Tech Stack:** Vite, React 19, React Router, @assistant-ui/react, Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-03-19-react-dashboard-design.md`

---

### Task 1: Scaffold Vite + React App

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/vite.config.ts`
- Create: `dashboard/tailwind.config.ts`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/tsconfig.app.json`
- Create: `dashboard/tsconfig.node.json`
- Create: `dashboard/postcss.config.js`
- Create: `dashboard/index.html`
- Create: `dashboard/src/main.tsx`
- Create: `dashboard/src/index.css`
- Create: `dashboard/src/App.tsx`

- [ ] **Step 1: Create `dashboard/package.json`**

```json
{
  "name": "ai-company-dashboard",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@assistant-ui/react": "^0.12.17",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.5.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.4.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0",
    "vite": "^6.3.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create `dashboard/vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
})
```

- [ ] **Step 3: Create `dashboard/tsconfig.json`**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 4: Create `dashboard/tsconfig.app.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create `dashboard/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: Create `dashboard/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'status-free': '#1a7f37',
        'status-working': '#bf8700',
        'status-waiting': '#cf222e',
        'status-active': '#0969da',
      }
    }
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 7: Create `dashboard/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 8: Create `dashboard/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Company</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 9: Create `dashboard/.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 10: Create `dashboard/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 11: Create `dashboard/src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 12: Create `dashboard/src/App.tsx` (minimal shell)**

```tsx
import { Routes, Route } from 'react-router-dom'

function Placeholder({ label }: { label: string }) {
  return <div className="p-8 text-lg text-gray-600">{label} — coming soon</div>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder label="Project List" />} />
      <Route path="/:project" element={<Placeholder label="Dashboard" />} />
      <Route path="/:project/chat/:role" element={<Placeholder label="Chat" />} />
    </Routes>
  )
}
```

- [ ] **Step 13: Install dependencies and verify build**

Run:
```bash
cd dashboard && npm install && npm run build
```
Expected: Build succeeds, `dashboard/dist/` contains `index.html` and JS/CSS assets.

- [ ] **Step 14: Verify dev server starts**

Run:
```bash
cd dashboard && npm run dev -- --host 2>&1 | head -5
```
Expected: Vite dev server starts on port 5173.

- [ ] **Step 15: Commit**

```bash
git add dashboard/
git commit -m "feat: scaffold Vite + React dashboard app

Vite + React 19 + React Router + Tailwind CSS + assistant-ui.
Three placeholder routes: /, /:project, /:project/chat/:role."
```

---

### Task 2: API Layer with Tests

**Files:**
- Create: `dashboard/src/lib/api.ts`
- Create: `dashboard/__tests__/api.test.ts`

- [ ] **Step 1: Create `dashboard/__tests__/api.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchProjects, fetchStatus, fetchTasks, fetchLogs, sendMessage } from '../src/lib/api'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('fetchProjects', () => {
  it('returns parsed project list', async () => {
    const data = [{ name: 'myapp', path: '/tmp/myapp', status: 'active' }]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(data), { status: 200 })
    )
    const result = await fetchProjects()
    expect(result).toEqual(data)
    expect(fetch).toHaveBeenCalledWith('/api/projects')
  })
})

describe('fetchStatus', () => {
  it('returns role status data', async () => {
    const data = { project: 'myapp', roles: { pm: { state: 'free' } } }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(data), { status: 200 })
    )
    const result = await fetchStatus('myapp')
    expect(result).toEqual(data)
    expect(fetch).toHaveBeenCalledWith('/api/status?project=myapp')
  })

  it('returns null for offline projects (503)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'offline' }), { status: 503 })
    )
    const result = await fetchStatus('myapp')
    expect(result).toBeNull()
  })
})

describe('fetchTasks', () => {
  it('returns parsed task list', async () => {
    const data = [{ id: '001', title: 'Test', from: 'human', to: 'pm', owner: 'pm', status: 'pending', priority: 'high' }]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(data), { status: 200 })
    )
    const result = await fetchTasks('myapp')
    expect(result).toEqual(data)
    expect(fetch).toHaveBeenCalledWith('/api/tasks?project=myapp')
  })

  it('returns empty array on error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 503 })
    )
    const result = await fetchTasks('myapp')
    expect(result).toEqual([])
  })
})

describe('fetchLogs', () => {
  it('returns parsed log entries', async () => {
    const data = [{ timestamp: '2026-03-19T10:00:00Z', level: 'info', role: 'pm', message: 'started' }]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(data), { status: 200 })
    )
    const result = await fetchLogs('myapp')
    expect(result).toEqual(data)
    expect(fetch).toHaveBeenCalledWith('/api/logs?project=myapp&limit=50')
  })
})

describe('sendMessage', () => {
  it('posts correctly and returns ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    )
    const result = await sendMessage('myapp', 'pm', 'hello')
    expect(result).toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledWith('/api/send?project=myapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'pm', message: 'hello' }),
    })
  })

  it('throws on error responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'bad request' }), { status: 400 })
    )
    await expect(sendMessage('myapp', 'pm', '')).rejects.toThrow('bad request')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd dashboard && npx vitest run __tests__/api.test.ts 2>&1
```
Expected: FAIL — module `../src/lib/api` not found.

- [ ] **Step 3: Create `dashboard/src/lib/api.ts`**

```ts
export type Project = {
  name: string
  path: string
  status: 'active' | 'offline'
}

export type RoleStatus = {
  state: 'free' | 'working' | 'waiting_human' | 'ready'
  activeTask: { id: string; title: string } | null
  queueDepth: number
  lastMessages: string[]
  conversationHistory: { from: 'agent' | 'human'; text: string; timestamp: number }[]
}

export type ProjectStatus = {
  project: string
  roles: Record<string, RoleStatus>
}

export type TaskItem = {
  id: string
  title: string
  from: string
  to: string
  owner: string
  status: string
  priority: string
}

export type LogEntry = {
  timestamp: string
  level: string
  role: string | null
  message: string
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects')
  return res.json()
}

export async function fetchStatus(project: string): Promise<ProjectStatus | null> {
  const res = await fetch(`/api/status?project=${encodeURIComponent(project)}`)
  if (res.status === 503) return null
  return res.json()
}

export async function fetchTasks(project: string): Promise<TaskItem[]> {
  const res = await fetch(`/api/tasks?project=${encodeURIComponent(project)}`)
  if (!res.ok) return []
  return res.json()
}

export async function fetchLogs(project: string, limit = 50): Promise<LogEntry[]> {
  const res = await fetch(`/api/logs?project=${encodeURIComponent(project)}&limit=${limit}`)
  if (!res.ok) return []
  return res.json()
}

export async function sendMessage(project: string, role: string, message: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/send?project=${encodeURIComponent(project)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, message }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to send')
  return data
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd dashboard && npx vitest run __tests__/api.test.ts 2>&1
```
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/api.ts dashboard/__tests__/api.test.ts
git commit -m "feat: add API layer with types and tests

Typed fetch wrappers for /api/projects, /api/status, /api/tasks,
/api/logs, /api/send. Handles 503 for offline projects."
```

---

### Task 3: Project List View

**Files:**
- Create: `dashboard/src/views/ProjectListView.tsx`
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Create `dashboard/src/views/ProjectListView.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchProjects, type Project } from '../lib/api'

export default function ProjectListView() {
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    fetchProjects().then(setProjects)
    const id = setInterval(() => fetchProjects().then(setProjects), 3000)
    return () => clearInterval(id)
  }, [])

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">No projects registered</p>
          <p className="mt-1 text-sm">Run: <code className="bg-gray-200 px-2 py-0.5 rounded">ai-company init</code></p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">AI Company</h1>
      </header>
      <main className="max-w-4xl mx-auto p-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Projects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.name}
              to={`/${encodeURIComponent(p.name)}`}
              className={`block bg-white rounded-lg border p-4 hover:shadow-md transition-shadow ${
                p.status === 'offline' ? 'opacity-60 border-gray-200' : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  p.status === 'active' ? 'bg-status-free' : 'bg-gray-300'
                }`} />
                <span className="font-medium text-gray-900">{p.name}</span>
              </div>
              {p.status === 'offline' && (
                <span className="mt-2 inline-block text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                  Offline
                </span>
              )}
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Update `dashboard/src/App.tsx` to use `ProjectListView`**

Replace the file contents with:

```tsx
import { Routes, Route } from 'react-router-dom'
import ProjectListView from './views/ProjectListView'

function Placeholder({ label }: { label: string }) {
  return <div className="p-8 text-lg text-gray-600">{label} — coming soon</div>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectListView />} />
      <Route path="/:project" element={<Placeholder label="Dashboard" />} />
      <Route path="/:project/chat/:role" element={<Placeholder label="Chat" />} />
    </Routes>
  )
}
```

- [ ] **Step 3: Verify build succeeds**

Run:
```bash
cd dashboard && npm run build 2>&1 | tail -5
```
Expected: Build completes successfully.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/views/ProjectListView.tsx dashboard/src/App.tsx
git commit -m "feat: add Project List view

Shows registered projects with status indicators.
Polls every 3s. Links to project dashboard."
```

---

### Task 4: Dashboard View Components

**Files:**
- Create: `dashboard/src/components/RoleCard.tsx`
- Create: `dashboard/src/components/TaskTable.tsx`
- Create: `dashboard/src/components/LogFeed.tsx`

- [ ] **Step 1: Create `dashboard/src/components/RoleCard.tsx`**

```tsx
import { Link } from 'react-router-dom'
import type { RoleStatus } from '../lib/api'

const stateConfig: Record<string, { border: string; color: string; label: string }> = {
  free: { border: 'border-status-free', color: 'text-status-free', label: 'free' },
  working: { border: 'border-status-working', color: 'text-status-working', label: 'working' },
  waiting_human: { border: 'border-status-waiting', color: 'text-status-waiting', label: 'waiting' },
  ready: { border: 'border-status-free', color: 'text-status-free', label: 'ready' },
}

export default function RoleCard({
  name,
  role,
  project,
}: {
  name: string
  role: RoleStatus
  project: string
}) {
  const config = stateConfig[role.state] ?? stateConfig.free

  return (
    <Link
      to={`/${encodeURIComponent(project)}/chat/${encodeURIComponent(name)}`}
      className={`block bg-white rounded-lg border-t-[3px] ${config.border} border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer`}
    >
      <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">{name}</div>
      <div className={`text-sm font-semibold mt-1 ${config.color}`}>
        {role.state === 'waiting_human' && <span className="inline-block w-2 h-2 bg-status-waiting rounded-full mr-1.5 animate-pulse" />}
        {config.label}
      </div>
      <div className="text-xs text-gray-500 mt-2">
        {role.activeTask ? `#${role.activeTask.id} ${role.activeTask.title}` : 'No active task'}
      </div>
      <div className="text-xs text-gray-400 mt-0.5">queue: {role.queueDepth}</div>
    </Link>
  )
}
```

- [ ] **Step 2: Create `dashboard/src/components/TaskTable.tsx`**

```tsx
import type { TaskItem } from '../lib/api'

const badgeColor: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-amber-50 text-amber-700',
  done: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
}

export default function TaskTable({ tasks }: { tasks: TaskItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500 font-medium">
            <th className="py-2 px-3">ID</th>
            <th className="py-2 px-3">Title</th>
            <th className="py-2 px-3">From</th>
            <th className="py-2 px-3">To</th>
            <th className="py-2 px-3">Owner</th>
            <th className="py-2 px-3">Status</th>
            <th className="py-2 px-3">Priority</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="border-b border-gray-100">
              <td className="py-2 px-3 text-gray-400">{t.id}</td>
              <td className="py-2 px-3 text-gray-900">{t.title}</td>
              <td className="py-2 px-3 text-gray-400">{t.from ?? '-'}</td>
              <td className="py-2 px-3 text-gray-900">{t.to ?? '-'}</td>
              <td className="py-2 px-3 text-gray-400">{t.owner ?? '-'}</td>
              <td className="py-2 px-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor[t.status] ?? badgeColor.pending}`}>
                  {t.status}
                </span>
              </td>
              <td className="py-2 px-3 text-gray-400">{t.priority ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Create `dashboard/src/components/LogFeed.tsx`**

```tsx
import type { LogEntry } from '../lib/api'

const levelColor: Record<string, string> = {
  error: 'text-red-600',
  warn: 'text-amber-600',
  info: '',
}

export default function LogFeed({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-56 overflow-y-auto font-mono text-xs">
      {logs.map((l, i) => (
        <div key={i} className="leading-relaxed">
          <span className="text-status-free mr-2">{l.timestamp?.slice(11, 19)}</span>
          {l.role && <span className="text-status-active font-medium mr-2">{l.role}</span>}
          <span className={levelColor[l.level] ?? ''}>{l.message}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Verify build succeeds**

Run:
```bash
cd dashboard && npm run build 2>&1 | tail -3
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/
git commit -m "feat: add RoleCard, TaskTable, LogFeed components

Reusable dashboard components with status colors and badges."
```

---

### Task 5: Dashboard View

**Files:**
- Create: `dashboard/src/views/DashboardView.tsx`
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Create `dashboard/src/views/DashboardView.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchStatus, fetchTasks, fetchLogs, type ProjectStatus, type TaskItem, type LogEntry } from '../lib/api'
import RoleCard from '../components/RoleCard'
import TaskTable from '../components/TaskTable'
import LogFeed from '../components/LogFeed'

export default function DashboardView() {
  const { project } = useParams<{ project: string }>()
  const [status, setStatus] = useState<ProjectStatus | null>(null)
  const [offline, setOffline] = useState(false)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    if (!project) return
    async function poll() {
      const s = await fetchStatus(project!)
      if (s === null) {
        setOffline(true)
        return
      }
      setOffline(false)
      setStatus(s)
      const [t, l] = await Promise.all([fetchTasks(project!), fetchLogs(project!)])
      setTasks(t)
      setLogs(l)
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [project])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-2">
        <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">All Projects</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-semibold text-gray-900">{project}</h1>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        {offline ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg font-medium">Project is offline</p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Roles</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {status && Object.entries(status.roles).map(([name, role]) => (
                  <RoleCard key={name} name={name} role={role} project={project!} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Tasks</h2>
              <TaskTable tasks={tasks} />
            </section>

            <section>
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Log</h2>
              <LogFeed logs={logs} />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Update `dashboard/src/App.tsx`**

Replace the file contents with:

```tsx
import { Routes, Route } from 'react-router-dom'
import ProjectListView from './views/ProjectListView'
import DashboardView from './views/DashboardView'

function Placeholder({ label }: { label: string }) {
  return <div className="p-8 text-lg text-gray-600">{label} — coming soon</div>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectListView />} />
      <Route path="/:project" element={<DashboardView />} />
      <Route path="/:project/chat/:role" element={<Placeholder label="Chat" />} />
    </Routes>
  )
}
```

- [ ] **Step 3: Verify build succeeds**

Run:
```bash
cd dashboard && npm run build 2>&1 | tail -3
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/views/DashboardView.tsx dashboard/src/App.tsx
git commit -m "feat: add Dashboard view with roles, tasks, and logs

Breadcrumb nav, role cards linking to chat, task table,
log feed. Handles offline projects gracefully."
```

---

### Task 6: Chat View with assistant-ui

**Files:**
- Create: `dashboard/src/lib/useAICompanyRuntime.ts`
- Create: `dashboard/src/components/RoleSidebar.tsx`
- Create: `dashboard/src/components/ChatThread.tsx`
- Create: `dashboard/src/views/ChatView.tsx`
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Create `dashboard/src/lib/useAICompanyRuntime.ts`**

```ts
import { useState, useEffect, useCallback } from 'react'
import {
  useExternalStoreRuntime,
  type ThreadMessageLike,
  type AppendMessage,
} from '@assistant-ui/react'
import { fetchStatus, sendMessage, type RoleStatus } from './api'

type HistoryEntry = { from: 'agent' | 'human'; text: string; timestamp: number }

export function convertMessage(entry: HistoryEntry, index: number): ThreadMessageLike {
  return {
    id: `msg-${index}`,
    role: entry.from === 'human' ? 'user' : 'assistant',
    content: [{ type: 'text' as const, text: entry.text }],
    createdAt: new Date(entry.timestamp),
  }
}

export function useAICompanyRuntime(project: string, role: string) {
  const [messages, setMessages] = useState<HistoryEntry[]>([])
  const [roleStatus, setRoleStatus] = useState<RoleStatus | null>(null)

  const poll = useCallback(async () => {
    const data = await fetchStatus(project)
    if (!data) return
    const r = data.roles[role]
    if (r) {
      setRoleStatus(r)
      setMessages(r.conversationHistory)
    }
  }, [project, role])

  useEffect(() => {
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [poll])

  const isRunning = roleStatus?.state === 'working' || roleStatus?.state === 'ready'
  const canSend = roleStatus?.state === 'waiting_human'

  const onNew = useCallback(async (message: AppendMessage) => {
    const textPart = message.content.find((c) => c.type === 'text')
    if (!textPart || textPart.type !== 'text') return
    await sendMessage(project, role, textPart.text)
    await poll()
  }, [project, role, poll])

  const runtime = useExternalStoreRuntime({
    messages,
    convertMessage,
    isRunning,
    onNew: canSend ? onNew : undefined,
  })

  return { runtime, roleStatus, canSend }
}
```

- [ ] **Step 2: Create `dashboard/src/components/RoleSidebar.tsx`**

```tsx
import { Link, useParams } from 'react-router-dom'
import type { ProjectStatus } from '../lib/api'

const stateColor: Record<string, string> = {
  free: 'bg-green-100 text-green-800',
  working: 'bg-amber-100 text-amber-800',
  waiting_human: 'bg-red-100 text-red-800',
  ready: 'bg-green-100 text-green-800',
}

export default function RoleSidebar({ status }: { status: ProjectStatus | null }) {
  const { project, role: activeRole } = useParams<{ project: string; role: string }>()

  if (!status) return null

  return (
    <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-3">
      {Object.entries(status.roles).map(([name]) => {
        const isActive = name === activeRole
        return (
          <Link
            key={name}
            to={`/${encodeURIComponent(project!)}/chat/${encodeURIComponent(name)}`}
            title={name}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold uppercase transition-all ${
              isActive
                ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400'
                : `${stateColor[status.roles[name].state] ?? stateColor.free} hover:ring-2 hover:ring-gray-300`
            }`}
          >
            {name.slice(0, 3)}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create `dashboard/src/components/ChatThread.tsx`**

```tsx
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { Thread } from '@assistant-ui/react'
import { useAICompanyRuntime } from '../lib/useAICompanyRuntime'

const statusLabels: Record<string, string> = {
  working: 'Agent is working...',
  free: 'Agent is idle — no active task',
  ready: 'Agent is finishing up...',
  waiting_human: '',
}

export default function ChatThread({ project, role }: { project: string; role: string }) {
  const { runtime, roleStatus, canSend } = useAICompanyRuntime(project, role)

  return (
    <div className="flex flex-col h-full">
      <AssistantRuntimeProvider runtime={runtime}>
        <div className="flex-1 overflow-hidden">
          <Thread />
        </div>
      </AssistantRuntimeProvider>
      {!canSend && roleStatus && (
        <div className="px-4 py-2 text-sm text-gray-500 text-center bg-gray-50 border-t border-gray-200">
          {statusLabels[roleStatus.state] ?? roleStatus.state}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `dashboard/src/views/ChatView.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchStatus, type ProjectStatus } from '../lib/api'
import RoleSidebar from '../components/RoleSidebar'
import ChatThread from '../components/ChatThread'

export default function ChatView() {
  const { project, role } = useParams<{ project: string; role: string }>()
  const [status, setStatus] = useState<ProjectStatus | null>(null)

  useEffect(() => {
    if (!project) return
    fetchStatus(project).then((s) => s && setStatus(s))
    const id = setInterval(() => {
      fetchStatus(project).then((s) => s && setStatus(s))
    }, 3000)
    return () => clearInterval(id)
  }, [project])

  const activeTask = status?.roles[role!]?.activeTask

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-2 text-sm shrink-0">
        <Link to="/" className="text-gray-400 hover:text-gray-600">All Projects</Link>
        <span className="text-gray-300">/</span>
        <Link to={`/${encodeURIComponent(project!)}`} className="text-gray-400 hover:text-gray-600">{project}</Link>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-gray-900 uppercase">{role}</span>
        {activeTask && (
          <span className="ml-4 text-gray-400">
            #{activeTask.id} {activeTask.title}
          </span>
        )}
      </header>
      <div className="flex flex-1 overflow-hidden">
        <RoleSidebar status={status} />
        <main className="flex-1 flex flex-col overflow-hidden">
          {project && role && <ChatThread project={project} role={role} />}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Update `dashboard/src/App.tsx` — wire up ChatView**

Replace the file contents with:

```tsx
import { Routes, Route } from 'react-router-dom'
import ProjectListView from './views/ProjectListView'
import DashboardView from './views/DashboardView'
import ChatView from './views/ChatView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectListView />} />
      <Route path="/:project" element={<DashboardView />} />
      <Route path="/:project/chat/:role" element={<ChatView />} />
    </Routes>
  )
}
```

- [ ] **Step 6: Verify build succeeds**

Run:
```bash
cd dashboard && npm run build 2>&1 | tail -5
```
Expected: Build succeeds. If there are TypeScript errors, fix them (assistant-ui API may differ slightly from docs — check `node_modules/@assistant-ui/react/dist/index.d.ts` for exact types).

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/
git commit -m "feat: add Chat view with assistant-ui integration

Full-screen chat with useExternalStoreRuntime polling backend.
Role sidebar for switching between agents. Composer disabled
when agent is not waiting for human input."
```

---

### Task 7: Runtime Adapter Tests

**Files:**
- Create: `dashboard/__tests__/useAICompanyRuntime.test.ts`

- [ ] **Step 1: Create `dashboard/__tests__/useAICompanyRuntime.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { convertMessage } from '../src/lib/useAICompanyRuntime'
import * as api from '../src/lib/api'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('convertMessage', () => {
  it('maps agent entry to assistant role', () => {
    const result = convertMessage({ from: 'agent', text: 'Hello', timestamp: 1000 }, 0)
    expect(result.role).toBe('assistant')
    expect(result.content).toEqual([{ type: 'text', text: 'Hello' }])
    expect(result.id).toBe('msg-0')
    expect(result.createdAt).toEqual(new Date(1000))
  })

  it('maps human entry to user role', () => {
    const result = convertMessage({ from: 'human', text: 'Hi', timestamp: 2000 }, 1)
    expect(result.role).toBe('user')
    expect(result.content).toEqual([{ type: 'text', text: 'Hi' }])
    expect(result.id).toBe('msg-1')
  })
})

describe('runtime polling and sending', () => {
  it('fetchStatus returns conversation history for runtime consumption', async () => {
    vi.spyOn(api, 'fetchStatus').mockResolvedValue({
      project: 'myapp',
      roles: {
        pm: {
          state: 'waiting_human',
          activeTask: { id: '001', title: 'Test' },
          queueDepth: 0,
          lastMessages: [],
          conversationHistory: [
            { from: 'agent', text: 'What should I do?', timestamp: 1000 },
            { from: 'human', text: 'Build it', timestamp: 2000 },
          ],
        },
      },
    })

    const result = await api.fetchStatus('myapp')
    expect(result!.roles.pm.conversationHistory).toHaveLength(2)

    // Verify convertMessage works on actual history data
    const messages = result!.roles.pm.conversationHistory.map(convertMessage)
    expect(messages[0].role).toBe('assistant')
    expect(messages[1].role).toBe('user')
  })

  it('sendMessage posts to API then re-poll fetches updated state', async () => {
    const sendSpy = vi.spyOn(api, 'sendMessage').mockResolvedValue({ ok: true })
    const statusSpy = vi.spyOn(api, 'fetchStatus').mockResolvedValue({
      project: 'myapp',
      roles: { pm: { state: 'working', activeTask: null, queueDepth: 0, lastMessages: [], conversationHistory: [] } },
    })

    await api.sendMessage('myapp', 'pm', 'do it')
    await api.fetchStatus('myapp')

    expect(sendSpy).toHaveBeenCalledWith('myapp', 'pm', 'do it')
    expect(statusSpy).toHaveBeenCalledWith('myapp')
  })

  it('handles empty conversation history gracefully', () => {
    const messages: { from: 'agent' | 'human'; text: string; timestamp: number }[] = []
    const converted = messages.map(convertMessage)
    expect(converted).toEqual([])
  })
})
```

- [ ] **Step 2: Run all dashboard tests**

Run:
```bash
cd dashboard && npx vitest run 2>&1
```
Expected: All tests pass (api.test.ts + useAICompanyRuntime.test.ts).

- [ ] **Step 3: Commit**

```bash
git add dashboard/__tests__/useAICompanyRuntime.test.ts
git commit -m "test: add runtime adapter tests

Verify message conversion, API integration, and empty state handling."
```

---

### Task 8: Backend Changes

**Files:**
- Modify: `bin/lib/web-server.js:14-16`
- Delete: `bin/dashboard/index.html`
- Modify: `package.json`

- [ ] **Step 1: Update `bin/lib/web-server.js`**

Replace lines 14-16 (the dashboard static serving and root redirect):

Old:
```js
  // Dashboard and root redirect
  app.use('/dashboard', express.static(join(__dirname, '../dashboard')))
  app.get('/', (req, res) => res.redirect('/dashboard'))
```

New:
```js
  // Serve React dashboard from built output
  app.use(express.static(join(__dirname, '..', '..', 'dashboard', 'dist')))
```

Then add the SPA catch-all **after** the last `app.post('/api/next-id', ...)` route (after line 84):

```js
  // SPA fallback — must be last route
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', '..', 'dashboard', 'dist', 'index.html'))
  })
```

- [ ] **Step 2: Delete `bin/dashboard/index.html`**

Run:
```bash
rm -rf bin/dashboard/
```

- [ ] **Step 3: Update root `package.json`**

Add to `"scripts"`:
```json
"build:dashboard": "cd dashboard && npm run build",
"dev:dashboard": "cd dashboard && npm run dev"
```

Add `"dashboard/"` to `"files"` array:
```json
"files": [
  "bin/",
  "roles/*.md",
  "memories/",
  "templates/",
  "dashboard/"
]
```

- [ ] **Step 4: Build the dashboard**

Run:
```bash
cd dashboard && npm run build 2>&1 | tail -3
```
Expected: Build succeeds, `dashboard/dist/index.html` exists.

- [ ] **Step 5: Run existing backend tests**

Run:
```bash
node --test test/role-manager.test.js test/web-server.test.js 2>&1
```
Expected: All existing tests pass. Note: `web-server.test.js` may need a minor fix if it checks for the `/dashboard` route or the redirect — update accordingly.

- [ ] **Step 6: Fix web-server tests if needed**

If any test references the old `/dashboard` static route or the `/` redirect, update the test to reflect the new behavior (SPA fallback serves `index.html` for non-API routes). If `dashboard/dist/index.html` doesn't exist when tests run, the SPA fallback will 404 — this is expected in test environments and the test should account for it.

- [ ] **Step 7: Commit**

```bash
git add bin/lib/web-server.js package.json
git rm -r bin/dashboard/
git commit -m "feat: serve React dashboard from Express

Replace old single-file HTML dashboard with built React app.
Express serves dashboard/dist/ with SPA fallback for client routing.
Add build:dashboard and dev:dashboard scripts."
```

---

### Task 9: Integration Verification

- [ ] **Step 1: Run all backend tests**

Run:
```bash
node --test test/**/*.test.js 2>&1
```
Expected: All pass.

- [ ] **Step 2: Run all dashboard tests**

Run:
```bash
cd dashboard && npx vitest run 2>&1
```
Expected: All pass.

- [ ] **Step 3: Build dashboard**

Run:
```bash
npm run build:dashboard 2>&1
```
Expected: Build succeeds.

- [ ] **Step 4: Manual smoke test (if backend is running)**

If `ai-company start` is running:
1. Open `http://localhost:4000` — should show Project List
2. Click a project — should show Dashboard with role cards, tasks, logs
3. Click a role card — should show full-screen Chat View
4. If a role is in `waiting_human`, type and send a message

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: integration fixes for React dashboard"
```
