# AI Company Web Coordinator Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bash `company-daemon` and tmux agent management with a Node.js coordinator using the Claude Agent SDK for reliable agent dispatch, and add a read-only web dashboard for monitoring tasks and role states.

**Architecture:** A single `bin/company-server.js` process wires together four focused modules: a chokidar file watcher, a role manager (state machine + per-role queues), a Claude Agent SDK runner (agent invocation + session persistence), and an express web server. The bash `bin/company` CLI is updated to start/stop the server and gains a `send` command for human input to waiting agents.

**Tech Stack:** Node.js 20+, `@anthropic-ai/claude-agent-sdk`, `express`, `chokidar`, `node:test` (built-in test runner, no extra dep)

**Spec:** `docs/superpowers/specs/2026-03-13-ai-company-web-coordinator-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `package.json` | Project metadata and 3 dependencies |
| `bin/company-server.js` | Entry point: initializes and wires all modules, handles SIGTERM |
| `bin/lib/task-parser.js` | Pure functions: parse frontmatter, `readTaskFile()`, `buildTaskList()`, `priorityOrder()` |
| `bin/lib/logger.js` | In-memory ring buffer (500 entries); `addLog()`, `getLogs()` |
| `bin/lib/role-manager.js` | Per-role runner objects, state machine, `scheduleDispatch()`, `tryDispatch()` |
| `bin/lib/sdk-runner.js` | Claude Agent SDK wrapper: `buildPrompt()`, `runAgent()`, session persistence in `roles/.sessions.json` |
| `bin/lib/file-watcher.js` | chokidar setup; on task file change calls `scheduleDispatch()` via role-manager |
| `bin/lib/web-server.js` | express HTTP server; 4 API endpoints + static dashboard |
| `bin/dashboard/index.html` | Single-file read-only dashboard (polls API every 3s, no build step) |
| `bin/company` | Updated bash CLI: `start`/`stop`/`send`; removes daemon/tmux references |
| `test/task-parser.test.js` | Tests for `readTaskFile`, `buildTaskList`, `priorityOrder` |
| `test/logger.test.js` | Tests for ring buffer overflow, `addLog`, `getLogs` |
| `test/role-manager.test.js` | Tests for all state transitions with mock SDK runner |
| `test/web-server.test.js` | Tests for all 4 API endpoints with fixture data |

**Deleted during this plan:**
- `bin/company-daemon`
- `bin/lib/tmux-helpers.sh`

---

## Chunk 1: Foundation — package setup, task-parser, logger

### Task 1: Initialize package.json and install dependencies

**Files:**
- Create: `package.json`

- [ ] **Step 1: Create package.json**

```bash
cat > /Users/cancan/Projects/AICompany/package.json << 'EOF'
{
  "name": "ai-company",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test test/**/*.test.js"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "latest",
    "chokidar": "^4.0.0",
    "express": "^4.18.0"
  }
}
EOF
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/cancan/Projects/AICompany && npm install
```

Expected: `node_modules/` created, `package-lock.json` created. No errors.

- [ ] **Step 3: Verify installs**

```bash
cd /Users/cancan/Projects/AICompany && node -e "import('@anthropic-ai/claude-agent-sdk').then(m => console.log('sdk ok')); import('chokidar').then(m => console.log('chokidar ok')); import('express').then(m => console.log('express ok'))"
```

Expected output:
```
sdk ok
chokidar ok
express ok
```

- [ ] **Step 4: Create test directory**

```bash
mkdir -p /Users/cancan/Projects/AICompany/test
```

- [ ] **Step 5: Commit**

```bash
cd /Users/cancan/Projects/AICompany && git init && git add package.json package-lock.json && git commit -m "chore: initialize Node.js project with dependencies"
```

---

### Task 2: task-parser module

**Files:**
- Create: `bin/lib/task-parser.js`
- Create: `test/task-parser.test.js`

The task-parser is pure functions only — no file system side effects except `readTaskFile` itself. All functions are synchronous except nothing; `readTaskFile` uses `fs.readFileSync`.

- [ ] **Step 1: Write failing tests**

Create `test/task-parser.test.js`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { readTaskFile, buildTaskList, priorityOrder } from '../bin/lib/task-parser.js'

const TMP = '/tmp/ai-company-test-tasks'

test.before(() => mkdirSync(TMP, { recursive: true }))
test.after(() => rmSync(TMP, { recursive: true, force: true }))

function writeTask(name, content) {
  writeFileSync(join(TMP, name), content)
  return join(TMP, name)
}

test('readTaskFile parses valid frontmatter', () => {
  const path = writeTask('001-test.md', `---
id: "001"
title: "Build auth"
status: pending
from: human
to: engineer
owner:
priority: high
created: 2026-03-13
updated: 2026-03-13
---

## Objective
Build auth
`)
  const task = readTaskFile(path)
  assert.equal(task.id, '001')
  assert.equal(task.title, 'Build auth')
  assert.equal(task.status, 'pending')
  assert.equal(task.from, 'human')
  assert.equal(task.to, 'engineer')
  assert.equal(task.priority, 'high')
  assert.equal(task.filepath, path)
})

test('readTaskFile returns null for missing file', () => {
  const result = readTaskFile('/tmp/does-not-exist.md')
  assert.equal(result, null)
})

test('readTaskFile returns null for malformed frontmatter', () => {
  const path = writeTask('bad.md', 'no frontmatter here')
  const result = readTaskFile(path)
  assert.equal(result, null)
})

test('priorityOrder sorts high before medium before low', () => {
  assert.ok(priorityOrder('high') < priorityOrder('medium'))
  assert.ok(priorityOrder('medium') < priorityOrder('low'))
  assert.ok(priorityOrder('low') < priorityOrder('unknown'))
})

test('buildTaskList returns tasks sorted by priority then created', () => {
  writeTask('002-b.md', `---
id: "002"
title: "Task B"
status: pending
from: human
to: engineer
owner:
priority: medium
created: 2026-03-13
updated: 2026-03-13
---
`)
  writeTask('003-c.md', `---
id: "003"
title: "Task C"
status: pending
from: human
to: engineer
owner:
priority: high
created: 2026-03-14
updated: 2026-03-14
---
`)
  const tasks = buildTaskList(TMP)
  const engineerTasks = tasks.filter(t => t.to === 'engineer' && t.status === 'pending')
  assert.equal(engineerTasks[0].priority, 'high')  // high before medium
  assert.equal(engineerTasks[1].priority, 'medium')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/cancan/Projects/AICompany && node --test test/task-parser.test.js
```

Expected: errors like `Cannot find module '../bin/lib/task-parser.js'`

- [ ] **Step 3: Create bin/lib directory and implement task-parser.js**

```bash
mkdir -p /Users/cancan/Projects/AICompany/bin/lib
```

Create `bin/lib/task-parser.js`:

```javascript
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const PRIORITY_MAP = { high: 0, medium: 1, low: 2 }

export function priorityOrder(priority) {
  return PRIORITY_MAP[priority] ?? 3
}

export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return null
  const result = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
    result[key] = value === 'null' ? null : value
  }
  return result
}

export function readTaskFile(filepath) {
  try {
    const content = readFileSync(filepath, 'utf8')
    const fields = parseFrontmatter(content)
    if (!fields || !fields.id) return null
    return {
      id: fields.id,
      title: fields.title ?? '',
      status: fields.status ?? 'pending',
      from: fields.from ?? null,
      to: fields.to ?? null,
      owner: fields.owner ?? null,
      priority: fields.priority ?? 'medium',
      created: fields.created ?? '',
      updated: fields.updated ?? '',
      filepath
    }
  } catch {
    return null
  }
}

export function buildTaskList(tasksDir) {
  let files
  try {
    files = readdirSync(tasksDir).filter(f => f.endsWith('.md') && !f.startsWith('.'))
  } catch {
    return []
  }
  const tasks = files
    .map(f => readTaskFile(join(tasksDir, f)))
    .filter(Boolean)
  tasks.sort((a, b) => {
    const pd = priorityOrder(a.priority) - priorityOrder(b.priority)
    if (pd !== 0) return pd
    return a.created.localeCompare(b.created)
  })
  return tasks
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /Users/cancan/Projects/AICompany && node --test test/task-parser.test.js
```

Expected:
```
✔ readTaskFile parses valid frontmatter
✔ readTaskFile returns null for missing file
✔ readTaskFile returns null for malformed frontmatter
✔ priorityOrder sorts high before medium before low
✔ buildTaskList returns tasks sorted by priority then created
```

- [ ] **Step 5: Commit**

```bash
cd /Users/cancan/Projects/AICompany && git add bin/lib/task-parser.js test/task-parser.test.js && git commit -m "feat: add task-parser module with frontmatter parsing"
```

---

### Task 3: logger module

**Files:**
- Create: `bin/lib/logger.js`
- Create: `test/logger.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/logger.test.js`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLogger } from '../bin/lib/logger.js'

test('addLog stores entries and getLogs returns them in order', () => {
  const log = createLogger()
  log.add('info', null, 'server started')
  log.add('warn', 'engineer', 'task delayed')
  const entries = log.get(10)
  assert.equal(entries.length, 2)
  assert.equal(entries[0].message, 'server started')
  assert.equal(entries[0].level, 'info')
  assert.equal(entries[0].role, null)
  assert.equal(entries[1].role, 'engineer')
  assert.ok(entries[0].timestamp)
})

test('getLogs returns at most n entries', () => {
  const log = createLogger()
  for (let i = 0; i < 10; i++) log.add('info', null, `msg ${i}`)
  assert.equal(log.get(3).length, 3)
})

test('ring buffer evicts oldest entries when capacity exceeded', () => {
  const log = createLogger(5)  // capacity 5
  for (let i = 0; i < 7; i++) log.add('info', null, `msg ${i}`)
  const entries = log.get(10)
  assert.equal(entries.length, 5)
  assert.equal(entries[0].message, 'msg 2')  // oldest 2 evicted
  assert.equal(entries[4].message, 'msg 6')
})

test('getLogs returns most recent entries last', () => {
  const log = createLogger()
  log.add('info', null, 'first')
  log.add('info', null, 'last')
  const entries = log.get(2)
  assert.equal(entries[entries.length - 1].message, 'last')
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
cd /Users/cancan/Projects/AICompany && node --test test/logger.test.js
```

Expected: `Cannot find module '../bin/lib/logger.js'`

- [ ] **Step 3: Implement logger.js**

Create `bin/lib/logger.js`:

```javascript
export function createLogger(capacity = 500) {
  const buffer = []

  function add(level, role, message) {
    buffer.push({ timestamp: new Date().toISOString(), level, role: role ?? null, message })
    if (buffer.length > capacity) buffer.shift()
  }

  function get(n = 50) {
    return buffer.slice(-n)
  }

  return { add, get }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /Users/cancan/Projects/AICompany && node --test test/logger.test.js
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/cancan/Projects/AICompany && git add bin/lib/logger.js test/logger.test.js && git commit -m "feat: add logger module with ring buffer"
```

---

## Chunk 2: Core Coordinator — role-manager, sdk-runner, file-watcher

### Task 4: role-manager module

**Files:**
- Create: `bin/lib/role-manager.js`
- Create: `test/role-manager.test.js`

The role-manager is the heart of the system. It takes `sdkRunner` and `logger` as injected dependencies so it's fully testable without a real SDK.

- [ ] **Step 1: Write failing tests**

Create `test/role-manager.test.js`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRoleManager } from '../bin/lib/role-manager.js'
import { createLogger } from '../bin/lib/logger.js'

function makeTask(overrides = {}) {
  return {
    id: '001', title: 'Test task', status: 'pending',
    from: 'human', to: 'engineer', priority: 'high',
    created: '2026-03-13', filepath: '/tmp/tasks/001-test.md',
    ...overrides
  }
}

function makeMockSdk(resultStatus = 'done') {
  const calls = []
  async function runAgent(task, role, sessionId) {
    calls.push({ task, role, sessionId })
    // Simulate agent updating the task file status
    return { sessionId: sessionId ?? `sess-${role}`, resultStatus }
  }
  runAgent.calls = calls
  return runAgent
}

function makeMockReadTask(status = 'done') {
  return (filepath) => ({ ...makeTask({ status, filepath }) })
}

test('initial state is free', () => {
  const mgr = createRoleManager(['engineer'], makeMockSdk(), makeMockReadTask(), createLogger())
  assert.equal(mgr.getState('engineer'), 'free')
})

test('enqueuing a pending task changes state to working', async () => {
  const sdk = makeMockSdk('done')
  const mgr = createRoleManager(['engineer'], sdk, makeMockReadTask('done'), createLogger())
  mgr.enqueue(makeTask({ to: 'engineer', status: 'pending' }))
  await mgr.waitIdle('engineer')
  assert.equal(mgr.getState('engineer'), 'free')
  assert.equal(sdk.calls.length, 1)
})

test('role stays working while sdk is in flight', async () => {
  let resolve
  const sdk = async () => {
    await new Promise(r => { resolve = r })
    return { sessionId: 'sess', resultStatus: 'done' }
  }
  const mgr = createRoleManager(['engineer'], sdk, makeMockReadTask('done'), createLogger())
  mgr.enqueue(makeTask({ to: 'engineer' }))
  await new Promise(r => setTimeout(r, 10))
  assert.equal(mgr.getState('engineer'), 'working')
  resolve()
})

test('state becomes waiting_human when sdk returns but task still in_progress', async () => {
  const sdk = makeMockSdk('done')
  const readTask = makeMockReadTask('in_progress')  // task file still in_progress after sdk returns
  const mgr = createRoleManager(['engineer'], sdk, readTask, createLogger())
  mgr.enqueue(makeTask({ to: 'engineer' }))
  await mgr.waitIdle('engineer')
  assert.equal(mgr.getState('engineer'), 'waiting_human')
})

test('second task queued while first is in flight — dispatched after first completes', async () => {
  const sdk = makeMockSdk('done')
  const mgr = createRoleManager(['engineer'], sdk, makeMockReadTask('done'), createLogger())
  mgr.enqueue(makeTask({ id: '001', to: 'engineer' }))
  mgr.enqueue(makeTask({ id: '002', to: 'engineer' }))
  await mgr.waitIdle('engineer')
  assert.equal(sdk.calls.length, 2)
})

test('getStatus returns state, activeTask, and queueDepth for all roles', () => {
  const mgr = createRoleManager(['engineer', 'pm'], makeMockSdk(), makeMockReadTask(), createLogger())
  const status = mgr.getStatus()
  assert.ok(status.engineer)
  assert.ok(status.pm)
  assert.equal(status.engineer.state, 'free')
  assert.equal(status.engineer.queueDepth, 0)
  assert.equal(status.engineer.activeTask, null)
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
cd /Users/cancan/Projects/AICompany && node --test test/role-manager.test.js
```

Expected: `Cannot find module '../bin/lib/role-manager.js'`

- [ ] **Step 3: Implement role-manager.js**

Create `bin/lib/role-manager.js`:

```javascript
export function createRoleManager(roles, sdkRunner, readTaskFile, logger) {
  const runners = {}

  for (const role of roles) {
    runners[role] = {
      state: 'free',
      queue: [],
      sdkInFlight: false,
      currentTask: null,
      sessionId: null,
      dispatchChain: Promise.resolve(),
      _idleResolvers: []
    }
  }

  function getRunner(role) {
    if (!runners[role]) throw new Error(`Unknown role: ${role}`)
    return runners[role]
  }

  function setSessionId(role, id) {
    if (id && id !== runners[role].sessionId) {
      runners[role].sessionId = id
    }
  }

  function scheduleDispatch(role) {
    const runner = getRunner(role)
    runner.dispatchChain = runner.dispatchChain.then(() => tryDispatch(role)).catch(err => {
      logger.add('error', role, `dispatch error: ${err.message}`)
    })
  }

  async function tryDispatch(role) {
    const runner = getRunner(role)
    if (runner.sdkInFlight) return

    if (runner.currentTask) {
      const fresh = readTaskFile(runner.currentTask.filepath)
      if (fresh && fresh.status === 'in_progress') {
        runner.state = 'waiting_human'
        logger.add('warn', role, `waiting for human input on task #${runner.currentTask.id}`)
        notifyIdle(role)
        return
      }
    }

    const next = runner.queue.shift()
    if (!next) {
      runner.state = 'free'
      runner.currentTask = null
      notifyIdle(role)
      return
    }

    runner.state = 'working'
    runner.sdkInFlight = true
    runner.currentTask = next
    logger.add('info', role, `dispatching task #${next.id}: ${next.title}`)

    try {
      const result = await sdkRunner(next, role, runner.sessionId)
      setSessionId(role, result?.sessionId)
    } catch (err) {
      logger.add('error', role, `sdk error on task #${next.id}: ${err.message}`)
    } finally {
      runner.sdkInFlight = false
      runner.state = 'ready'                 // transient ready state visible to dashboard
      runner.currentTask = readTaskFile(next.filepath) ?? { ...next, status: 'done' }
      scheduleDispatch(role)
    }
  }

  function notifyIdle(role) {
    const runner = runners[role]
    for (const resolve of runner._idleResolvers) resolve()
    runner._idleResolvers = []
  }

  function enqueue(task) {
    const role = task.to
    if (!runners[role]) return
    if (task.status !== 'pending') return
    // Deduplicate: skip if already queued
    if (runners[role].queue.some(t => t.id === task.id)) return
    runners[role].queue.push(task)
    runners[role].queue.sort((a, b) => {
      const pd = priorityOrder(a.priority) - priorityOrder(b.priority)
      return pd !== 0 ? pd : a.created.localeCompare(b.created)
    })
    scheduleDispatch(role)
  }

  function priorityOrder(p) {
    return { high: 0, medium: 1, low: 2 }[p] ?? 3
  }

  function getState(role) {
    return getRunner(role).state
  }

  function getStatus() {
    const result = {}
    for (const [role, runner] of Object.entries(runners)) {
      result[role] = {
        state: runner.state,
        activeTask: runner.currentTask ? { id: runner.currentTask.id, title: runner.currentTask.title } : null,
        queueDepth: runner.queue.length
      }
    }
    return result
  }

  function waitIdle(role) {
    const runner = getRunner(role)
    if (runner.state === 'free' || runner.state === 'waiting_human') return Promise.resolve()
    return new Promise(resolve => runner._idleResolvers.push(resolve))
  }

  function loadSessions(sessions) {
    for (const [role, id] of Object.entries(sessions)) {
      if (runners[role]) runners[role].sessionId = id
    }
  }

  function getSessions() {
    const result = {}
    for (const [role, runner] of Object.entries(runners)) {
      if (runner.sessionId) result[role] = runner.sessionId
    }
    return result
  }

  return { enqueue, getState, getStatus, scheduleDispatch, loadSessions, getSessions, waitIdle }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /Users/cancan/Projects/AICompany && node --test test/role-manager.test.js
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/cancan/Projects/AICompany && git add bin/lib/role-manager.js test/role-manager.test.js && git commit -m "feat: add role-manager with state machine and serialized dispatch"
```

---

### Task 5: sdk-runner module

**Files:**
- Create: `bin/lib/sdk-runner.js`

This module wraps the Claude Agent SDK. It is not unit-tested (it calls the real SDK), but its helper `buildPrompt` is pure and verifiable by inspection.

- [ ] **Step 1: Create bin/lib/sdk-runner.js**

```javascript
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export function buildPrompt(task, role, projectDir) {
  const taskContent = readFileSync(task.filepath, 'utf8')
  const claudeMdPath = join(projectDir, 'roles', role, 'CLAUDE.md')
  const companyMdPath = join(projectDir, 'company.md')

  const claudeMd = existsSync(claudeMdPath) ? readFileSync(claudeMdPath, 'utf8') : ''
  const companyMd = existsSync(companyMdPath) ? readFileSync(companyMdPath, 'utf8') : ''

  return [
    `# Your Role\n${claudeMd}`,
    `# Company Context\n${companyMd}`,
    `# Your Task\n${taskContent}`,
    `You are the ${role}. Complete the task above. When done, update the task file status to "done" (or "rejected" with a reason). Update your memory.md with any handoff notes.`
  ].join('\n\n---\n\n')
}

export function createSdkRunner(projectDir, sessionsPath) {
  async function runAgent(task, role, sessionId) {
    // Dynamic import to avoid top-level SDK load errors if not configured
    const { query } = await import('@anthropic-ai/claude-agent-sdk')

    const options = {
      cwd: join(projectDir, 'roles', role),
      permissionMode: 'bypassPermissions'
    }
    if (sessionId) options.resume = sessionId

    const prompt = buildPrompt(task, role, projectDir)
    let lastSessionId = sessionId
    let resultStatus = 'unknown'

    for await (const message of query({ prompt, options })) {
      if (message.type === 'result') {
        lastSessionId = message.session_id ?? lastSessionId
        resultStatus = message.subtype ?? 'done'
      }
    }

    // Persist updated session id
    if (lastSessionId && lastSessionId !== sessionId) {
      let sessions = {}
      if (existsSync(sessionsPath)) {
        try { sessions = JSON.parse(readFileSync(sessionsPath, 'utf8')) } catch {}
      }
      sessions[role] = lastSessionId
      writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2))
    }

    return { sessionId: lastSessionId, resultStatus }
  }

  return runAgent
}
```

- [ ] **Step 2: Verify syntax**

```bash
cd /Users/cancan/Projects/AICompany && node --check bin/lib/sdk-runner.js
```

Expected: no output (no syntax errors).

- [ ] **Step 3: Commit**

```bash
cd /Users/cancan/Projects/AICompany && git add bin/lib/sdk-runner.js && git commit -m "feat: add sdk-runner module wrapping Claude Agent SDK"
```

---

### Task 6: file-watcher module

**Files:**
- Create: `bin/lib/file-watcher.js`

- [ ] **Step 1: Create bin/lib/file-watcher.js**

```javascript
import chokidar from 'chokidar'
import { readTaskFile } from './task-parser.js'

export function createFileWatcher(tasksDir, roleManager, logger) {
  const watcher = chokidar.watch(`${tasksDir}/*.md`, {
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
  })

  function handleTaskFile(filepath) {
    const task = readTaskFile(filepath)
    if (!task) return

    logger.add('info', task.to, `file event: ${task.id} status=${task.status}`)

    if (task.status === 'pending') {
      roleManager.enqueue(task)
    } else if (task.status === 'done' || task.status === 'rejected') {
      // Unblock the to-role if it is in waiting_human (human resolved the task by editing the file)
      if (task.to) roleManager.scheduleDispatch(task.to)
      // Notify the from-role so it can pick up its next pending task
      if (task.from && task.from !== 'human') roleManager.scheduleDispatch(task.from)
    }
  }

  watcher.on('add', handleTaskFile)
  watcher.on('change', handleTaskFile)
  watcher.on('error', err => logger.add('error', null, `watcher error: ${err.message}`))

  return {
    close: () => watcher.close()
  }
}
```

- [ ] **Step 2: Verify syntax**

```bash
cd /Users/cancan/Projects/AICompany && node --check bin/lib/file-watcher.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/cancan/Projects/AICompany && git add bin/lib/file-watcher.js && git commit -m "feat: add file-watcher module using chokidar"
```

---

## Chunk 3: Web Layer, Entry Point, CLI, and Dashboard

### Task 7: web-server module

**Files:**
- Create: `bin/lib/web-server.js`
- Create: `test/web-server.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/web-server.test.js`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createWebServer } from '../bin/lib/web-server.js'
import { createLogger } from '../bin/lib/logger.js'
import { createRoleManager } from '../bin/lib/role-manager.js'

function makeFixtures() {
  const logger = createLogger()
  logger.add('info', 'engineer', 'test log')

  const roleManager = createRoleManager(
    ['engineer', 'pm'],
    async () => ({ sessionId: 'sess', resultStatus: 'done' }),
    () => null,
    logger
  )

  const taskStore = {
    getAll: () => [
      { id: '001', title: 'Task A', from: 'human', to: 'engineer', status: 'pending', priority: 'high', created: '2026-03-13', updated: '2026-03-13' }
    ]
  }

  return { logger, roleManager, taskStore }
}

async function request(server, path) {
  const { address, port } = server.address()
  const url = `http://${address === '::' ? 'localhost' : address}:${port}${path}`
  const res = await fetch(url)
  return { status: res.status, body: await res.json() }
}

test('GET /api/status returns role states', async (t) => {
  const { logger, roleManager, taskStore } = makeFixtures()
  const server = createWebServer(roleManager, taskStore, logger, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status, body } = await request(server, '/api/status')
  assert.equal(status, 200)
  assert.ok(body.roles)
  assert.ok(body.roles.engineer)
  assert.equal(body.roles.engineer.state, 'free')
  assert.equal(body.roles.engineer.queueDepth, 0)
})

test('GET /api/tasks returns task list', async (t) => {
  const { logger, roleManager, taskStore } = makeFixtures()
  const server = createWebServer(roleManager, taskStore, logger, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status, body } = await request(server, '/api/tasks')
  assert.equal(status, 200)
  assert.equal(body.tasks.length, 1)
  assert.equal(body.tasks[0].id, '001')
})

test('GET /api/logs returns log entries', async (t) => {
  const { logger, roleManager, taskStore } = makeFixtures()
  const server = createWebServer(roleManager, taskStore, logger, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status, body } = await request(server, '/api/logs')
  assert.equal(status, 200)
  assert.equal(body.logs.length, 1)
  assert.equal(body.logs[0].message, 'test log')
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
cd /Users/cancan/Projects/AICompany && node --test test/web-server.test.js
```

Expected: `Cannot find module '../bin/lib/web-server.js'`

- [ ] **Step 3: Implement web-server.js**

Create `bin/lib/web-server.js`:

```javascript
import express from 'express'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function createWebServer(roleManager, taskStore, logger, { port = 4000 } = {}) {
  const app = express()

  app.use(express.static(join(__dirname, '../dashboard')))

  app.get('/api/status', (req, res) => {
    res.json({ roles: roleManager.getStatus() })
  })

  app.get('/api/tasks', (req, res) => {
    res.json({ tasks: taskStore.getAll() })
  })

  app.get('/api/logs', (req, res) => {
    res.json({ logs: logger.get(50) })
  })

  const server = app.listen(port)
  return server
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /Users/cancan/Projects/AICompany && node --test test/web-server.test.js
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/cancan/Projects/AICompany && git add bin/lib/web-server.js test/web-server.test.js && git commit -m "feat: add web-server module with 3 API endpoints"
```

---

### Task 8: Dashboard HTML

**Files:**
- Create: `bin/dashboard/index.html`

- [ ] **Step 1: Create dashboard directory and HTML**

```bash
mkdir -p /Users/cancan/Projects/AICompany/bin/dashboard
```

Create `bin/dashboard/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Company Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #e6edf3; min-height: 100vh; }
    header { background: #161b22; border-bottom: 1px solid #30363d; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; }
    header h1 { font-size: 16px; font-weight: 600; }
    #refresh-info { font-size: 12px; color: #8b949e; }
    #alert-banner { display: none; background: #3d1414; border-left: 4px solid #f85149; padding: 12px 24px; font-size: 13px; color: #ffa198; }
    main { padding: 20px 24px; }
    section { margin-bottom: 24px; }
    section h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #8b949e; margin-bottom: 12px; }
    #role-cards { display: flex; gap: 12px; flex-wrap: wrap; }
    .role-card { background: #161b22; border-radius: 8px; padding: 14px; min-width: 160px; flex: 1; border-top: 3px solid #30363d; }
    .role-card.free, .role-card.ready { border-top-color: #3fb950; }
    .role-card.working { border-top-color: #ffa657; }
    .role-card.waiting_human { border-top-color: #f85149; }
    .role-name { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8b949e; }
    .role-state { font-size: 13px; font-weight: 600; margin: 4px 0; }
    .role-state.free, .role-state.ready { color: #3fb950; }
    .role-state.working { color: #ffa657; }
    .role-state.waiting_human { color: #f85149; }
    .role-meta { font-size: 11px; color: #8b949e; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 8px 12px; color: #8b949e; font-weight: normal; border-bottom: 1px solid #21262d; }
    td { padding: 8px 12px; border-bottom: 1px solid #21262d; }
    tr.waiting { background: #1a0a0a; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .badge.pending { color: #8b949e; border: 1px solid #30363d; }
    .badge.in_progress { color: #ffa657; border: 1px solid #5a3800; }
    .badge.done { color: #3fb950; border: 1px solid #0d3321; }
    .badge.rejected { color: #f85149; border: 1px solid #3d1414; }
    #log-box { background: #161b22; border-radius: 8px; padding: 12px 16px; font-family: monospace; font-size: 11px; max-height: 200px; overflow-y: auto; }
    .log-entry { line-height: 1.8; color: #8b949e; }
    .log-entry .ts { color: #3fb950; margin-right: 8px; }
    .log-entry .role-tag { color: #58a6ff; margin-right: 8px; }
    .log-entry.error .msg { color: #f85149; }
    .log-entry.warn .msg { color: #ffa657; }
  </style>
</head>
<body>
  <header>
    <h1>AI Company</h1>
    <span id="refresh-info">refreshing every 3s</span>
  </header>

  <div id="alert-banner"></div>

  <main>
    <section>
      <h2>Roles</h2>
      <div id="role-cards"></div>
    </section>

    <section>
      <h2>Tasks</h2>
      <table>
        <thead><tr><th>ID</th><th>Title</th><th>From</th><th>To</th><th>Status</th><th>Priority</th></tr></thead>
        <tbody id="task-rows"></tbody>
      </table>
    </section>

    <section>
      <h2>Log</h2>
      <div id="log-box"></div>
    </section>
  </main>

  <script>
    async function fetchJson(url) {
      const res = await fetch(url)
      return res.json()
    }

    function renderRoles(roles) {
      const container = document.getElementById('role-cards')
      const waiting = []
      container.innerHTML = Object.entries(roles).map(([name, r]) => {
        if (r.state === 'waiting_human') waiting.push({ name, task: r.activeTask })
        return `<div class="role-card ${r.state}">
          <div class="role-name">${name}</div>
          <div class="role-state ${r.state}">${stateLabel(r.state)}</div>
          <div class="role-meta">${r.activeTask ? `#${r.activeTask.id} ${r.activeTask.title}` : 'No active task'}<br>queue: ${r.queueDepth}</div>
        </div>`
      }).join('')

      const banner = document.getElementById('alert-banner')
      if (waiting.length) {
        banner.style.display = 'block'
        banner.innerHTML = '⚠ Waiting for human input: ' + waiting.map(w =>
          `<strong>${w.name}</strong>${w.task ? ` on task #${w.task.id} "${w.task.title}"` : ''}`
        ).join(', ') + ` — run <code>company send &lt;role&gt; "your message"</code>`
      } else {
        banner.style.display = 'none'
      }
    }

    function stateLabel(s) {
      return { free: '✓ free', working: '⟳ working', waiting_human: '⚠ waiting', ready: '✓ ready' }[s] || s
    }

    function renderTasks(tasks) {
      document.getElementById('task-rows').innerHTML = tasks.map(t => `
        <tr class="${t.status === 'in_progress' ? 'waiting' : ''}">
          <td style="color:#8b949e">${t.id}</td>
          <td>${t.title}</td>
          <td style="color:#8b949e">${t.from ?? '-'}</td>
          <td>${t.to ?? '-'}</td>
          <td><span class="badge ${t.status}">${t.status}</span></td>
          <td style="color:#8b949e">${t.priority}</td>
        </tr>`).join('')
    }

    function renderLogs(logs) {
      const box = document.getElementById('log-box')
      box.innerHTML = logs.map(l => `
        <div class="log-entry ${l.level}">
          <span class="ts">${l.timestamp.slice(11, 19)}</span>
          ${l.role ? `<span class="role-tag">${l.role}</span>` : ''}
          <span class="msg">${l.message}</span>
        </div>`).join('')
      box.scrollTop = box.scrollHeight
    }

    async function refresh() {
      try {
        const [{ roles }, { tasks }, { logs }] = await Promise.all([
          fetchJson('/api/status'),
          fetchJson('/api/tasks'),
          fetchJson('/api/logs')
        ])
        renderRoles(roles)
        renderTasks(tasks)
        renderLogs(logs)
        document.getElementById('refresh-info').textContent = `updated ${new Date().toLocaleTimeString()}`
      } catch (e) {
        document.getElementById('refresh-info').textContent = 'connection lost — retrying...'
      }
    }

    refresh()
    setInterval(refresh, 3000)
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify the file was created**

```bash
wc -l /Users/cancan/Projects/AICompany/bin/dashboard/index.html
```

Expected: ~120+ lines.

- [ ] **Step 3: Commit**

```bash
cd /Users/cancan/Projects/AICompany && git add bin/dashboard/index.html && git commit -m "feat: add read-only web dashboard"
```

---

### Task 9: company-server.js entry point

**Files:**
- Create: `bin/company-server.js`

- [ ] **Step 1: Create bin/company-server.js**

```javascript
#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLogger }      from './lib/logger.js'
import { createRoleManager } from './lib/role-manager.js'
import { createSdkRunner }   from './lib/sdk-runner.js'
import { createFileWatcher } from './lib/file-watcher.js'
import { createWebServer }   from './lib/web-server.js'
import { buildTaskList, readTaskFile } from './lib/task-parser.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR   = join(__dirname, '..')
const TASKS_DIR     = join(PROJECT_DIR, 'tasks')
const SESSIONS_PATH = join(PROJECT_DIR, 'roles', '.sessions.json')
const PID_FILE      = join(TASKS_DIR, '.server-pid')
const LOG_DIR       = join(PROJECT_DIR, 'logs')

mkdirSync(TASKS_DIR, { recursive: true })
mkdirSync(LOG_DIR, { recursive: true })

function loadRoles() {
  const rolesDir = join(PROJECT_DIR, 'roles')
  if (!existsSync(rolesDir)) return []
  return readdirSync(rolesDir)
    .filter(name => !name.startsWith('.') && statSync(join(rolesDir, name)).isDirectory())
}

async function main() {
  const logger = createLogger()
  const roles  = loadRoles()

  if (roles.length === 0) {
    console.error('No roles found in roles/ directory. Run company init first.')
    process.exit(1)
  }

  const sdkRunner   = createSdkRunner(PROJECT_DIR, SESSIONS_PATH)
  const roleManager = createRoleManager(roles, sdkRunner, readTaskFile, logger)

  if (existsSync(SESSIONS_PATH)) {
    try {
      const sessions = JSON.parse(readFileSync(SESSIONS_PATH, 'utf8'))
      roleManager.loadSessions(sessions)
      logger.add('info', null, `loaded sessions for: ${Object.keys(sessions).join(', ')}`)
    } catch {}
  }

  const taskStore   = { getAll: () => buildTaskList(TASKS_DIR) }
  const webServer   = createWebServer(roleManager, taskStore, logger, { port: 4000 })
  const fileWatcher = createFileWatcher(TASKS_DIR, roleManager, logger)

  writeFileSync(PID_FILE, String(process.pid))
  logger.add('info', null, `company-server started (PID ${process.pid})`)
  console.log(`AI Company server running — dashboard: http://localhost:4000`)

  function shutdown() {
    logger.add('info', null, 'shutting down')
    fileWatcher.close()
    webServer.close()
    try { unlinkSync(PID_FILE) } catch {}
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1) })
```

- [ ] **Step 2: Verify syntax**

```bash
cd /Users/cancan/Projects/AICompany && node --check bin/company-server.js
```

Expected: no output.

- [ ] **Step 3: Make executable**

```bash
chmod +x /Users/cancan/Projects/AICompany/bin/company-server.js
```

- [ ] **Step 4: Commit**

```bash
cd /Users/cancan/Projects/AICompany && git add bin/company-server.js && git commit -m "feat: add company-server entry point wiring all modules"
```

---

### Task 10: Update bin/company CLI

**Files:**
- Modify: `bin/company` (existing bash script from ai-company skill template — copy it first if not present)

The existing `bin/company` bash script needs three changes:
1. `cmd_start` — replace tmux + daemon launch with `node bin/company-server &`
2. `cmd_stop` — read `.server-pid` instead of `.daemon-pid`, kill the server process
3. Add `cmd_send` — append human input to a role's current task and signal the server

- [ ] **Step 1: Copy existing company script if not present**

```bash
[ -f /Users/cancan/Projects/AICompany/bin/company ] || cp /Users/cancan/.claude/skills/ai-company/bin/company /Users/cancan/Projects/AICompany/bin/company
chmod +x /Users/cancan/Projects/AICompany/bin/company
```

- [ ] **Step 1b: Verify get_field helper is present in bin/company**

```bash
grep -n "get_field\|parse_field" /Users/cancan/Projects/AICompany/bin/company | head -5
```

Expected: at least one line showing `get_field` is defined or sourced. If a different name is used (e.g. `parse_field`), use that name in `cmd_send` in Step 4 instead.

- [ ] **Step 2: Replace cmd_start in bin/company**

Find the existing `cmd_start()` function and replace it with:

```bash
cmd_start() {
  local pid_file="$TASKS_DIR/.server-pid"
  if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "Server already running (PID $(cat "$pid_file")). Use 'company stop' first."
    exit 1
  fi

  echo "Starting AI Company server..."
  nohup node "$COMPANY_BIN_DIR/company-server.js" >> "$PROJECT_DIR/logs/server.log" 2>&1 &
  sleep 1
  if [ -f "$pid_file" ]; then
    echo "Server started (PID $(cat "$pid_file")). Dashboard: http://localhost:4000"
  else
    echo "ERROR: Server failed to start. Check logs/server.log"
    exit 1
  fi
}
```

- [ ] **Step 3: Replace cmd_stop in bin/company**

Find the existing `cmd_stop()` function and replace it with:

```bash
cmd_stop() {
  local pid_file="$TASKS_DIR/.server-pid"
  if [ ! -f "$pid_file" ]; then
    echo "No server PID file found. Server may not be running."
    exit 1
  fi
  local pid
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    echo "Server stopped (PID $pid)."
  else
    echo "Server PID $pid not running. Cleaning up PID file."
    rm -f "$pid_file"
  fi
}
```

- [ ] **Step 4: Add cmd_send and wire it into the dispatch**

Add after `cmd_stop`:

```bash
cmd_send() {
  local role="$1"
  local message="$2"

  if [ -z "$role" ] || [ -z "$message" ]; then
    echo "Usage: company send <role> \"message\""
    exit 1
  fi

  # Find the current in-progress task for this role
  local task_file=""
  for f in "$TASKS_DIR"/*.md; do
    [ -f "$f" ] || continue
    local to status
    to="$(get_field "$f" "to")"
    status="$(get_field "$f" "status")"
    if [ "$to" = "$role" ] && [ "$status" = "in_progress" ]; then
      task_file="$f"
      break
    fi
  done

  if [ -z "$task_file" ]; then
    echo "No in-progress task found for role '$role'."
    exit 1
  fi

  # Append human input section to task file (triggers chokidar watcher)
  printf "\n\n## Human Input\n\n%s\n" "$message" >> "$task_file"
  echo "Message sent to $role via $(basename "$task_file")"
}
```

- [ ] **Step 5: Update the main dispatch case to add send and remove tmux commands**

In the `case "$command" in` block at the bottom, ensure it includes:

```bash
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  health)  cmd_health ;;
  status)  cmd_status ;;
  tasks)   cmd_tasks "$@" ;;
  next-id) cmd_next_id ;;
  create)  cmd_create "$@" ;;
  send)    cmd_send "$@" ;;
  *)       usage ;;
```

- [ ] **Step 6: Update usage() to reflect new commands and remove tmux/daemon references**

Replace `restart` line and add `send` in the usage string:

```bash
usage() {
  cat <<EOF_USAGE
Usage: company <command> [args]

Commands:
  start                    Launch company-server (web dashboard on :4000)
  stop                     Stop the company-server
  health                   Show server health (PID, uptime)
  status                   Show dashboard of all roles and task counts
  tasks [role]             List all tasks, optionally filtered by role
  next-id                  Print the next sequential task ID
  create <to-role> <title> Create a new task from human
  send <role> "message"    Send a message to a waiting agent
EOF_USAGE
}
```

- [ ] **Step 7: Verify syntax**

```bash
bash -n /Users/cancan/Projects/AICompany/bin/company
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
cd /Users/cancan/Projects/AICompany && git add bin/company && git commit -m "feat: update company CLI — add send command, replace daemon with server"
```

---

### Task 11: Delete deprecated files

**Files:**
- Delete: `bin/company-daemon`
- Delete: `bin/lib/tmux-helpers.sh`

- [ ] **Step 1: Remove deprecated files**

```bash
cd /Users/cancan/Projects/AICompany
rm -f bin/company-daemon bin/lib/tmux-helpers.sh
```

- [ ] **Step 2: Verify files are gone**

```bash
ls /Users/cancan/Projects/AICompany/bin/company-daemon /Users/cancan/Projects/AICompany/bin/lib/tmux-helpers.sh 2>&1
```

Expected: `No such file or directory` for both paths.

- [ ] **Step 3: Commit**

```bash
cd /Users/cancan/Projects/AICompany && git add -A && git commit -m "chore: remove company-daemon and tmux-helpers (replaced by company-server)"
```

---

### Task 12: Run full test suite and smoke test

- [ ] **Step 1: Run all tests**

```bash
cd /Users/cancan/Projects/AICompany && node --test test/task-parser.test.js test/logger.test.js test/role-manager.test.js test/web-server.test.js
```

Expected: all tests pass. Count should be:
- task-parser: 5 tests
- logger: 4 tests
- role-manager: 6 tests
- web-server: 3 tests
- Total: 18 tests

Note: `sdk-runner` and `file-watcher` have no test files — they are verified by syntax check only (see Tasks 5 and 6).

- [ ] **Step 2: Create a test project structure for smoke test**

```bash
mkdir -p /Users/cancan/Projects/AICompany/roles/engineer
cat > /Users/cancan/Projects/AICompany/roles/engineer/CLAUDE.md << 'EOF'
# Engineer

You are the engineer. Complete coding tasks.
EOF
cat > /Users/cancan/Projects/AICompany/company.md << 'EOF'
# Company Memory

## Project
Test project for smoke testing.
EOF
```

- [ ] **Step 3: Create a test task**

```bash
/Users/cancan/Projects/AICompany/bin/company create engineer "Test task for smoke test"
```

Expected: `Created: tasks/001-test-task-for-smoke-test.md`

- [ ] **Step 4: Verify task file was created correctly**

```bash
cat /Users/cancan/Projects/AICompany/tasks/001-test-task-for-smoke-test.md
```

Expected: frontmatter with `to: engineer`, `status: pending`

- [ ] **Step 5: Verify server starts and all endpoints respond**

```bash
cd /Users/cancan/Projects/AICompany && node bin/company-server.js &
sleep 2
curl -sf http://localhost:4000/           | grep -q 'AI Company'  && echo "DASHBOARD OK" || echo "DASHBOARD FAIL"
curl -sf http://localhost:4000/api/status | grep -q '"roles"'     && echo "STATUS OK"    || echo "STATUS FAIL"
curl -sf http://localhost:4000/api/tasks  | grep -q '"tasks"'     && echo "TASKS OK"     || echo "TASKS FAIL"
curl -sf http://localhost:4000/api/logs   | grep -q '"logs"'      && echo "LOGS OK"      || echo "LOGS FAIL"
```

Expected:
```
AI Company server running — dashboard: http://localhost:4000
DASHBOARD OK
STATUS OK
TASKS OK
LOGS OK
```

- [ ] **Step 6: Stop the server**

```bash
kill $(cat /Users/cancan/Projects/AICompany/tasks/.server-pid)
```

- [ ] **Step 7: Clean up smoke test fixtures and commit**

The smoke test fixtures (dummy role, company.md, test task) should not be committed to the repo. Remove them:

```bash
cd /Users/cancan/Projects/AICompany
rm -rf roles/ company.md tasks/001-test-task-for-smoke-test.md
```

Then commit only the source files:

```bash
cd /Users/cancan/Projects/AICompany && git add bin/ test/ package.json package-lock.json && git commit -m "feat: complete ai-company web coordinator implementation"
```
