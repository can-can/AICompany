# AI Company npm Distribution Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the per-project `bin/` setup into a globally installed `ai-company` npm package with a single hub server managing multiple isolated projects from one dashboard.

**Architecture:** A new `bin/ai-company.js` JS CLI replaces the bash `bin/company` script. A `bin/lib/project-registry.js` module manages `~/.ai-company/projects.json`. The hub server (`bin/company-server.js`) reads the registry and creates isolated FileWatcher+RoleManager instances per project. One Express server at `:4000` serves all projects through parameterised API routes.

**Tech Stack:** Node.js 18+ ESM, Express 4, chokidar 4, `@anthropic-ai/claude-agent-sdk`, `node:test` for unit tests.

---

## Chunk 1: Registry, CLI, and Templates

### Task 1: bin/lib/project-registry.js

**Files:**
- Create: `bin/lib/project-registry.js`
- Create: `test/project-registry.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/project-registry.test.js`:

```javascript
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Override home dir for tests via env var
let tmpHome
beforeEach(() => {
  tmpHome = join(tmpdir(), `ac-test-${process.pid}-${Date.now()}`)
  mkdirSync(tmpHome, { recursive: true })
  process.env.AI_COMPANY_HOME = tmpHome
})
afterEach(() => {
  rmSync(tmpHome, { recursive: true, force: true })
  delete process.env.AI_COMPANY_HOME
})

// No cache-busting needed: project-registry exports FUNCTIONS for paths,
// so setting process.env.AI_COMPANY_HOME before calling them is sufficient.
import { readRegistry, addProject, removeProject, resolveProject } from '../bin/lib/project-registry.js'

test('readRegistry returns [] when no file exists', () => {
  assert.deepEqual(readRegistry(), [])
})

test('addProject writes entry to registry', () => {
  addProject('MyApp', '/tmp/myapp')
  const projects = readRegistry()
  assert.equal(projects.length, 1)
  assert.equal(projects[0].name, 'MyApp')
})

test('addProject deduplicates by name', () => {
  addProject('MyApp', '/tmp/myapp')
  addProject('MyApp', '/tmp/myapp2')
  assert.equal(readRegistry().length, 1)
  assert.equal(readRegistry()[0].path, '/tmp/myapp2')
})

test('addProject deduplicates by path', () => {
  addProject('MyApp', '/tmp/myapp')
  addProject('MyApp2', '/tmp/myapp')
  assert.equal(readRegistry().length, 1)
})

test('removeProject removes by name', () => {
  addProject('MyApp', '/tmp/myapp')
  removeProject('MyApp')
  assert.equal(readRegistry().length, 0)
})

test('resolveProject finds project when cwd matches path', () => {
  addProject('MyApp', '/tmp/myapp')
  const found = resolveProject('/tmp/myapp')
  assert.equal(found?.name, 'MyApp')
})

test('resolveProject finds project when cwd is subdirectory', () => {
  addProject('MyApp', '/tmp/myapp')
  const found = resolveProject('/tmp/myapp/src/components')
  assert.equal(found?.name, 'MyApp')
})

test('resolveProject returns null when not inside any project', () => {
  addProject('MyApp', '/tmp/myapp')
  assert.equal(resolveProject('/tmp/other'), null)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/cancan/Projects/AICompany && node --test test/project-registry.test.js
```
Expected: `ERR_MODULE_NOT_FOUND` or similar — file doesn't exist yet.

- [ ] **Step 3: Implement project-registry.js**

Create `bin/lib/project-registry.js`:

```javascript
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'

// Path helpers read process.env.AI_COMPANY_HOME at CALL TIME, not module load time.
// Tests can set the env var in beforeEach and get isolation without any cache-busting tricks.
function getRegistryDir() { return process.env.AI_COMPANY_HOME ?? join(homedir(), '.ai-company') }
function getRegistryPath() { return join(getRegistryDir(), 'projects.json') }
function getPidPath() { return join(getRegistryDir(), '.server-pid') }

function readRegistry() {
  const registryPath = getRegistryPath()
  if (!existsSync(registryPath)) return []
  try {
    return JSON.parse(readFileSync(registryPath, 'utf8'))
  } catch {
    return []
  }
}

function writeRegistry(projects) {
  mkdirSync(getRegistryDir(), { recursive: true })
  writeFileSync(getRegistryPath(), JSON.stringify(projects, null, 2))
}

function addProject(name, projectPath) {
  const abs = resolve(projectPath)
  const projects = readRegistry().filter(p => p.name !== name && p.path !== abs)
  projects.push({ name, path: abs })
  writeRegistry(projects)
}

function removeProject(nameOrPath) {
  const abs = resolve(nameOrPath)
  const filtered = readRegistry().filter(p => p.name !== nameOrPath && p.path !== abs)
  writeRegistry(filtered)
}

// Walk up from cwd, return first matching registered project or null
function resolveProject(cwd) {
  const projects = readRegistry()
  let dir = resolve(cwd)
  while (true) {
    const match = projects.find(p => p.path === dir)
    if (match) return match
    const parent = join(dir, '..')
    if (parent === dir) return null
    dir = parent
  }
}

export { readRegistry, writeRegistry, addProject, removeProject, resolveProject, getRegistryDir, getRegistryPath, getPidPath }
```

- [ ] **Step 4: Run tests — all should pass**

```bash
node --test test/project-registry.test.js
```
Expected: 8 passing tests.

- [ ] **Step 5: Commit**

```bash
git add bin/lib/project-registry.js test/project-registry.test.js
git commit -m "feat: add project-registry module for ~/.ai-company/projects.json management"
```

---

### Task 2: Add getNextId to task-parser.js + update package.json

**Files:**
- Modify: `bin/lib/task-parser.js` (add `getNextId`)
- Modify: `package.json` (add `bin`, `files`)
- Modify: `test/task-parser.test.js` (add tests for getNextId)

- [ ] **Step 1: Read the existing test file**

```bash
cat test/task-parser.test.js
```
Read it to understand existing test patterns before adding.

- [ ] **Step 2: Add failing test for getNextId**

The existing `test/task-parser.test.js` starts with:
```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { readTaskFile, buildTaskList, priorityOrder } from '../bin/lib/task-parser.js'
```

Make these two changes to the import block:
1. Add `import { tmpdir } from 'node:os'` after the `node:path` import line
2. Add `getNextId` to the existing task-parser import: `import { readTaskFile, buildTaskList, priorityOrder, getNextId } from '../bin/lib/task-parser.js'`

Then append these tests at the end of the file (no new import lines needed — imports were merged above):

```javascript
test('getNextId bootstraps from existing task files when no counter file', (t) => {
  const dir = join(tmpdir(), `tasks-${Date.now()}`)
  mkdirSync(dir)
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  // Write a task file with id 003
  writeFileSync(join(dir, '003-some-task.md'), `---\nid: "003"\ntitle: "Task"\nstatus: pending\n---\n`)

  const id = getNextId(dir)
  assert.equal(id, '004')
})

test('getNextId uses counter file when present', (t) => {
  const dir = join(tmpdir(), `tasks-${Date.now()}`)
  mkdirSync(dir)
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, '.next-id'), '7')
  const id = getNextId(dir)
  assert.equal(id, '007')
})

test('getNextId increments counter file after call', (t) => {
  const dir = join(tmpdir(), `tasks-${Date.now()}`)
  mkdirSync(dir)
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, '.next-id'), '5')
  getNextId(dir)  // consume 005
  const id2 = getNextId(dir)  // should be 006
  assert.equal(id2, '006')
})

test('getNextId returns 001 when tasks dir is empty and no counter', (t) => {
  const dir = join(tmpdir(), `tasks-${Date.now()}`)
  mkdirSync(dir)
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  const id = getNextId(dir)
  assert.equal(id, '001')
})
```

- [ ] **Step 3: Run to verify tests fail**

```bash
node --test test/task-parser.test.js 2>&1 | grep -E 'getNextId|SyntaxError|Error'
```
Expected: `getNextId is not exported` or import error.

- [ ] **Step 4: Add getNextId to task-parser.js**

Replace the existing `import { ... } from 'node:fs'` line at the top of `bin/lib/task-parser.js` with:

```javascript
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
```

(The current file imports only `readFileSync` and `readdirSync` — this adds `existsSync` and `writeFileSync`.)

Add this function at the end of `bin/lib/task-parser.js`:

```javascript
export function getNextId(tasksDir) {
  const counterFile = join(tasksDir, '.next-id')
  let next

  if (existsSync(counterFile)) {
    next = parseInt(readFileSync(counterFile, 'utf8').trim(), 10)
    if (isNaN(next)) next = 1
  } else {
    // Bootstrap: scan existing task files for highest numeric id
    let max = 0
    try {
      const files = readdirSync(tasksDir).filter(f => f.endsWith('.md') && !f.startsWith('.'))
      for (const f of files) {
        const task = readTaskFile(join(tasksDir, f))
        if (!task?.id) continue
        const n = parseInt(task.id, 10)
        if (!isNaN(n) && n > max) max = n
      }
    } catch {}
    next = max + 1
  }

  writeFileSync(counterFile, String(next + 1))
  return String(next).padStart(3, '0')
}
```

Also update the existing `readFileSync` import if needed — the current file uses only `readFileSync` and `readdirSync`; add `existsSync` and `writeFileSync`.

- [ ] **Step 5: Run tests — all should pass**

```bash
node --test test/task-parser.test.js
```
Expected: all existing tests + 4 new tests passing.

- [ ] **Step 6: Update package.json**

Merge these fields into the existing `package.json` (add/overwrite these keys; do not delete other existing fields like `devDependencies`, `license`, `author`):

```json
{
  "name": "ai-company",
  "version": "1.0.0",
  "description": "Multi-agent AI coordination framework — global hub managing multiple isolated projects",
  "type": "module",
  "bin": {
    "ai-company": "bin/ai-company.js"
  },
  "files": [
    "bin/",
    "roles/",
    "memories/",
    "templates/"
  ],
  "scripts": {
    "test": "node --test test/**/*.test.js"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "latest",
    "chokidar": "^4.0.0",
    "express": "^4.18.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add bin/lib/task-parser.js test/task-parser.test.js package.json
git commit -m "feat: add getNextId to task-parser, update package.json with bin/files fields"
```

---

### Task 3: bin/ai-company.js — global CLI

**Files:**
- Create: `bin/ai-company.js`

This task implements all CLI commands **except** `init` (which requires template files — done in Task 4).

- [ ] **Step 1: Create bin/ai-company.js with argument parsing and hub lifecycle commands**

Create `bin/ai-company.js`:

```javascript
#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, openSync, readdirSync, statSync, copyFileSync } from 'node:fs'
import { join, resolve, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SERVER_PATH = join(__dirname, 'company-server.js')

// Parse argv: flags like --project foo, positional args
function parseArgs(argv) {
  const args = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      const next = argv[i + 1]
      flags[key] = (next && !next.startsWith('--')) ? argv[++i] : true
    } else {
      args.push(argv[i])
    }
  }
  return { args, flags }
}

function isRunning(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

// Dynamically import registry (so AI_COMPANY_HOME env var is respected)
async function reg() {
  return import('./lib/project-registry.js')
}

async function requireProject(flags) {
  const { resolveProject, readRegistry } = await reg()
  if (flags.project) {
    const projects = readRegistry()
    const found = projects.find(p => p.name === flags.project)
    if (!found) {
      console.error(`Error: Project '${flags.project}' not found in registry.`)
      console.error('  Run: ai-company list')
      process.exit(1)
    }
    return found
  }
  const found = resolveProject(process.cwd())
  if (!found) {
    console.error('Error: Not inside a registered project directory.')
    console.error('  Use --project <name> or run from inside a project.')
    console.error('  Registered projects: ai-company list')
    process.exit(1)
  }
  return found
}

// ── Hub lifecycle ──────────────────────────────────────────────────────────────

async function cmdStart() {
  const { getRegistryDir, getPidPath } = await reg()
  const registryDir = getRegistryDir()
  const pidPath = getPidPath()

  // Auth check: ~/.claude must exist
  const claudeDir = join(homedir(), '.claude')
  console.log('Checking Claude Code authentication...')
  if (!existsSync(claudeDir)) {
    console.error('✗ Not authenticated with Claude Code.')
    console.error('  Run: claude login')
    console.error('  Then: ai-company start')
    process.exit(1)
  }

  // Stale PID check
  if (existsSync(pidPath)) {
    const pid = parseInt(readFileSync(pidPath, 'utf8').trim(), 10)
    if (isRunning(pid)) {
      console.log(`Server already running (PID ${pid}). Dashboard: http://localhost:4000`)
      return
    }
    console.warn(`Removing stale PID file (PID ${pid} is not running)`)
    unlinkSync(pidPath)
  }

  mkdirSync(registryDir, { recursive: true })
  const logPath = join(registryDir, 'server.log')
  const logFd = openSync(logPath, 'a')

  const child = spawn(process.execPath, [SERVER_PATH], {
    detached: true,
    stdio: ['ignore', logFd, logFd]
  })
  child.unref()

  // Wait up to 3s for PID file to appear
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 500))
    if (existsSync(pidPath)) {
      const pid = readFileSync(pidPath, 'utf8').trim()
      console.log(`Server started (PID ${pid}). Dashboard: http://localhost:4000`)
      return
    }
  }
  console.error(`Server failed to start. Check ${logPath}`)
  process.exit(1)
}

async function cmdStop() {
  const { getPidPath } = await reg()
  const pidPath = getPidPath()
  if (!existsSync(pidPath)) {
    console.error('No server PID file found. Server may not be running.')
    process.exit(1)
  }
  const pid = parseInt(readFileSync(pidPath, 'utf8').trim(), 10)
  if (isRunning(pid)) {
    process.kill(pid, 'SIGTERM')
    unlinkSync(pidPath)
    console.log(`Server stopped (PID ${pid}).`)
  } else {
    unlinkSync(pidPath)
    console.log(`Server PID ${pid} not running. Cleaned up PID file.`)
  }
}

async function cmdHealth() {
  const { getPidPath } = await reg()
  const pidPath = getPidPath()
  if (!existsSync(pidPath)) {
    console.error('CRIT: No PID file. Server is not running.')
    process.exit(1)
  }
  const pid = parseInt(readFileSync(pidPath, 'utf8').trim(), 10)
  if (!isRunning(pid)) {
    console.error(`CRIT: Server PID ${pid} is not running.`)
    process.exit(1)
  }
  console.log(`Server PID: ${pid} (alive)`)
  console.log('Dashboard:  http://localhost:4000')
  console.log('Status:     OK')
}

// ── Project management ────────────────────────────────────────────────────────

async function cmdList() {
  const { readRegistry } = await reg()
  const projects = readRegistry()
  if (projects.length === 0) {
    console.log('No registered projects. Run: ai-company init')
    return
  }
  console.log(`${'NAME'.padEnd(20)} PATH`)
  console.log(`${'----'.padEnd(20)} ----`)
  for (const p of projects) {
    const exists = existsSync(p.path) ? '' : ' (offline)'
    console.log(`${p.name.padEnd(20)} ${p.path}${exists}`)
  }
}

async function cmdRegister(args) {
  const { addProject } = await reg()
  const dir = resolve(args[0] || process.cwd())
  if (!existsSync(dir)) {
    console.error(`Directory not found: ${dir}`)
    process.exit(1)
  }
  const name = basename(dir)
  addProject(name, dir)
  console.log(`Registered project '${name}' at ${dir}`)
  console.log('If the hub is running, it will pick up the new project automatically.')
}

async function cmdUnregister(args) {
  const { removeProject } = await reg()
  const nameOrDir = args[0] || process.cwd()
  removeProject(nameOrDir)
  console.log(`Unregistered: ${nameOrDir}`)
}

// ── Task management ───────────────────────────────────────────────────────────

async function cmdStatus(flags) {
  const project = await requireProject(flags)
  const rolesDir = join(project.path, 'roles')
  const { readTaskFile } = await import('./lib/task-parser.js')
  const tasksDir = join(project.path, 'tasks')

  let tasks = []
  try {
    tasks = readdirSync(tasksDir)
      .filter(f => f.endsWith('.md') && !f.startsWith('.'))
      .map(f => readTaskFile(join(tasksDir, f)))
      .filter(Boolean)
  } catch {}

  const roles = existsSync(rolesDir)
    ? readdirSync(rolesDir).filter(n => !n.startsWith('.') && statSync(join(rolesDir, n)).isDirectory())
    : []

  console.log(`\nProject: ${project.name}`)
  console.log(`${'ROLE'.padEnd(14)} ${'PENDING'.padEnd(10)} ${'IN PROGRESS'.padEnd(12)} DONE`)
  console.log(`${'----'.padEnd(14)} ${'-------'.padEnd(10)} ${'----------'.padEnd(12)} ----`)
  for (const role of roles) {
    const pending = tasks.filter(t => t.to === role && t.status === 'pending').length
    const inProgress = tasks.filter(t => t.to === role && t.status === 'in_progress').length
    const done = tasks.filter(t => t.to === role && t.status === 'done').length
    console.log(`${role.padEnd(14)} ${String(pending).padEnd(10)} ${String(inProgress).padEnd(12)} ${done}`)
  }
}

async function cmdTasks(args, flags) {
  const filterRole = args[0]
  const project = await requireProject(flags)
  const { buildTaskList } = await import('./lib/task-parser.js')
  const tasksDir = join(project.path, 'tasks')
  const tasks = buildTaskList(tasksDir)

  const filtered = filterRole ? tasks.filter(t => t.to === filterRole || t.from === filterRole || t.owner === filterRole) : tasks
  console.log(`${'ID'.padEnd(6)} ${'TITLE'.padEnd(35)} ${'FROM'.padEnd(10)} ${'TO'.padEnd(10)} STATUS`)
  console.log(`${'---'.padEnd(6)} ${'-----'.padEnd(35)} ${'----'.padEnd(10)} ${'--'.padEnd(10)} ------`)
  for (const t of filtered) {
    console.log(`${(t.id ?? '-').padEnd(6)} ${(t.title ?? '-').slice(0, 34).padEnd(35)} ${(t.from ?? '-').padEnd(10)} ${(t.to ?? '-').padEnd(10)} ${t.status}`)
  }
}

async function cmdNextId(flags) {
  const project = await requireProject(flags)
  const { getNextId } = await import('./lib/task-parser.js')
  const tasksDir = join(project.path, 'tasks')
  mkdirSync(tasksDir, { recursive: true })
  console.log(getNextId(tasksDir))
}

async function cmdCreate(args, flags) {
  const role = args[0]
  const title = args.slice(1).join(' ')
  if (!role || !title) {
    console.error('Usage: ai-company create <role> <title> [--project <name>]')
    process.exit(1)
  }

  const project = await requireProject(flags)
  const roleDir = join(project.path, 'roles', role)
  if (!existsSync(roleDir)) {
    console.error(`Unknown role '${role}' in project '${project.name}'`)
    process.exit(1)
  }

  const { getNextId } = await import('./lib/task-parser.js')
  const tasksDir = join(project.path, 'tasks')
  mkdirSync(tasksDir, { recursive: true })
  const nextId = getNextId(tasksDir)
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
  const filename = `${nextId}-${slug}.md`
  const today = new Date().toISOString().slice(0, 10)

  writeFileSync(join(tasksDir, filename), [
    '---',
    `id: "${nextId}"`,
    'parent: null',
    'from: human',
    `to: ${role}`,
    'owner:',
    'status: pending',
    'priority: medium',
    `created: ${today}`,
    `updated: ${today}`,
    `title: "${title}"`,
    '---',
    '',
    '## Objective',
    '',
    title,
    '',
    '## Details',
    '',
    '(Add details here)',
  ].join('\n'))

  console.log(`Created: tasks/${filename}`)
}

async function cmdSend(args, flags) {
  const role = args[0]
  const message = args[1]
  if (!role || !message) {
    console.error('Usage: ai-company send <role> "message" [--project <name>]')
    process.exit(1)
  }

  const project = await requireProject(flags)
  const { readTaskFile } = await import('./lib/task-parser.js')
  const tasksDir = join(project.path, 'tasks')

  let taskFile = null
  try {
    const files = readdirSync(tasksDir).filter(f => f.endsWith('.md') && !f.startsWith('.'))
    for (const f of files) {
      const t = readTaskFile(join(tasksDir, f))
      // 'waiting_human' is a runtime server state — the task file stays 'in_progress' while
      // the agent is paused waiting for human input. in_progress is the correct file-level proxy.
      if (t?.to === role && t?.status === 'in_progress') { taskFile = join(tasksDir, f); break }
    }
  } catch {}

  if (!taskFile) {
    console.error(`No in-progress task found for role '${role}' in project '${project.name}'.`)
    process.exit(1)
  }

  const existing = readFileSync(taskFile, 'utf8')
  writeFileSync(taskFile, existing + `\n\n## Human Input\n\n${message}\n`)
  console.log(`Message sent to ${role} via ${basename(taskFile)}`)
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

const [,, command, ...rest] = process.argv
const { args, flags } = parseArgs(rest)

const commands = {
  start:      () => cmdStart(),
  stop:       () => cmdStop(),
  health:     () => cmdHealth(),
  list:       () => cmdList(),
  register:   () => cmdRegister(args),
  unregister: () => cmdUnregister(args),
  status:     () => cmdStatus(flags),
  tasks:      () => cmdTasks(args, flags),
  'next-id':  () => cmdNextId(flags),
  create:     () => cmdCreate(args, flags),
  send:       () => cmdSend(args, flags),
}

if (!command || !commands[command]) {
  console.log(`Usage: ai-company <command> [args]

Hub:        start | stop | health
Projects:   init [dir] | register [dir] | unregister [dir] | list
Tasks:      create <role> <title> | tasks [role] | send <role> "msg" | next-id | status

Options:    --project <name>  (target a specific project from any directory)`)
  process.exit(command ? 1 : 0)
}

commands[command]().catch(err => { console.error(err.message); process.exit(1) })
```

- [ ] **Step 2: Make executable**

```bash
chmod +x /Users/cancan/Projects/AICompany/bin/ai-company.js
```

- [ ] **Step 3: Smoke test the CLI (no server needed)**

```bash
cd /Users/cancan/Projects/AICompany
node bin/ai-company.js --help 2>&1 || node bin/ai-company.js
```
Expected: usage text printed.

```bash
node bin/ai-company.js list
```
Expected: "No registered projects" or lists existing ones.

- [ ] **Step 4: Commit**

```bash
git add bin/ai-company.js
git commit -m "feat: add global ai-company JS CLI with hub lifecycle and task management commands"
```

---

### Task 4: Role/memory templates + init command

**Files:**
- Create: `roles/pm.md`, `roles/engineer.md`, `roles/qa.md`, `roles/ceo.md`, `roles/designer.md`, `roles/ops.md`, `roles/marketing.md`, `roles/sales.md`
- Create: `memories/pm.md` (and engineer, qa, ceo, designer, ops, marketing, sales)
- Create: `templates/company.md`
- Modify: `bin/ai-company.js` (add `cmdInit`)

- [ ] **Step 1: Create role templates**

Create `roles/pm.md`:
````markdown
# Role: PM

You are the Project Manager. You receive high-level goals and break them into concrete tasks for other roles.

## Responsibilities
- Break objectives into implementable tasks with clear acceptance criteria
- Assign tasks to the right roles
- Review completed work against acceptance criteria
- Report status back to the requester

## When you receive a task
1. Read `../../company.md` for project context
2. Read your `memory.md` for handoff notes from previous sessions
3. Break the goal into concrete subtasks
4. For each subtask, run `ai-company next-id` to reserve a unique ID (call once per task, collect all IDs first)
5. Create task files in `../../tasks/` using those IDs, assigned to the right role
6. Update your task status to `done` when subtasks are created
7. Update `memory.md` with handoff notes

## Task file format
```
---
id: "007"
parent: null
from: pm
to: engineer
owner:
status: pending
priority: medium
created: 2026-03-14
updated: 2026-03-14
title: "Build the login page"
---

## Objective
...

## Acceptance Criteria
- [ ] criterion 1
- [ ] criterion 2
```

## Constraints
- Never write code — delegate to Engineer
- Every task needs testable acceptance criteria
- Tasks you create must be independent — if B needs A's output, create A first, wait for completion, then create B
````

Create `roles/engineer.md`:
```markdown
# Role: Engineer

You are the Engineer. You implement features, write code, and complete technical tasks.

## Responsibilities
- Implement features based on specs from the PM
- Write clean, working code with tests
- Update task status when complete

## When you receive a task
1. Read `../../company.md` for project context
2. Read your `memory.md` for handoff notes from previous sessions
3. Implement what is described in the task
4. Update task status to `done` when complete, or `rejected` with reason if impossible
5. Update `memory.md` with handoff notes

## Constraints
- Never skip tests for new functionality
- Never expand scope beyond what was specified
- Set `status: rejected` (with questions in the task body) if the spec is unclear
```

Create `roles/qa.md`:
```markdown
# Role: QA

You are the QA Engineer. You test features, verify behavior, and report issues.

## Responsibilities
- Test implemented features against acceptance criteria
- Report bugs with clear reproduction steps
- Mark tasks done when passing, rejected with details when failing

## When you receive a task
1. Read `../../company.md` for project context
2. Read your `memory.md` for handoff notes from previous sessions
3. Test the specified feature or behavior against each acceptance criterion
4. Update task status to `done` if all criteria pass, `rejected` with findings if any fail
5. Update `memory.md` with handoff notes
```

Create `roles/ceo.md`:
```markdown
# Role: CEO

You are the CEO. You define what to build and why — strategic direction only.

## Responsibilities
- Define strategic objectives and success criteria
- Prioritize work at the initiative level
- Delegate execution to PM

## When you receive a task
1. Read `../../company.md` for context
2. Read your `memory.md` for handoff notes
3. Analyze the strategic request and define a clear objective with success criteria
4. Create a task for the PM with the strategic brief
5. Update task status to `done` when delegated
6. Update `memory.md` with handoff notes

## Constraints
- Never specify HOW to build — that is PM's job
- Never write code or design UI
```

Create `roles/designer.md`:
```markdown
# Role: Designer

You are the Designer. You create detailed design specs — layouts, colors, typography, responsive behavior.

## Responsibilities
- Translate product requirements into detailed design specs
- Define component structure, visual hierarchy, and interactions
- Hand off specs to Engineer for implementation

## When you receive a task
1. Read `../../company.md` for context
2. Read your `memory.md` for handoff notes
3. Create a detailed design spec (layout, colors, typography, responsive breakpoints)
4. Update task status to `done` when spec is complete
5. Update `memory.md` with handoff notes

## Constraints
- Produce written specs, not mockup files
- Never write production code
```

Create `roles/ops.md`:
```markdown
# Role: Ops

You are the Ops Engineer. You deploy QA-approved builds and maintain infrastructure.

## Responsibilities
- Deploy builds that have passed QA
- Document deployment steps and rollback procedures
- Monitor and report on system health

## When you receive a task
1. Read `../../company.md` for context
2. Read your `memory.md` for handoff notes
3. Execute the deployment or infrastructure task
4. Update task status to `done` when complete, `rejected` if blockers prevent deployment
5. Update `memory.md` with handoff notes and rollback procedure
```

Create `roles/marketing.md`:
```markdown
# Role: Marketing

You are the Marketing specialist. You write copy, positioning, and campaign content.

## Responsibilities
- Write product copy, landing pages, and marketing materials
- Define positioning and messaging
- Create campaign content

## When you receive a task
1. Read `../../company.md` for context
2. Read your `memory.md` for handoff notes
3. Produce the requested marketing content
4. Update task status to `done` when content is ready
5. Update `memory.md` with handoff notes
```

Create `roles/sales.md`:
```markdown
# Role: Sales

You are the Sales specialist. You develop sales strategy, outreach copy, and sales collateral.

## Responsibilities
- Write outreach emails, sales decks, and proposals
- Define sales strategy and target segments
- Create collateral that supports the sales process

## When you receive a task
1. Read `../../company.md` for context
2. Read your `memory.md` for handoff notes
3. Produce the requested sales content or strategy
4. Update task status to `done` when complete
5. Update `memory.md` with handoff notes
```

- [ ] **Step 2: Create memory templates**

Create `memories/pm.md`:
```markdown
# PM Memory

## Delivery Tracker

(Track active task chains and their status across roles)

## Handoff Notes

(Updated before ending each session — what was done, key decisions, blockers)
```

Create each of the following files with the content shown:

`memories/engineer.md`:
```markdown
# Engineer Memory

## Handoff Notes

(Updated before ending each session — what was built, key decisions, blockers)
```

`memories/qa.md`:
```markdown
# QA Memory

## Handoff Notes

(Updated before ending each session — what was tested, issues found, decisions)
```

`memories/ceo.md`:
```markdown
# CEO Memory

## Handoff Notes

(Updated before ending each session — strategic decisions, priorities set, context for next session)
```

`memories/designer.md`:
```markdown
# Designer Memory

## Handoff Notes

(Updated before ending each session — design decisions made, components defined, open questions)
```

`memories/ops.md`:
```markdown
# Ops Memory

## Handoff Notes

(Updated before ending each session — deployments done, rollback procedures, infra state)
```

`memories/marketing.md`:
```markdown
# Marketing Memory

## Handoff Notes

(Updated before ending each session — copy produced, campaigns active, brand decisions)
```

`memories/sales.md`:
```markdown
# Sales Memory

## Handoff Notes

(Updated before ending each session — outreach sent, strategy decisions, pipeline state)
```

- [ ] **Step 3: Create templates/company.md**

Create `templates/company.md`:
````markdown
# Company Memory

Shared context for all roles.

## Project

{{name}} — {{goal}}

## Workflow

```
{{workflow}}
```

## Company Conventions

- Tasks live in `tasks/` — single source of truth
- One file per task: `<id>-<slug>.md`
- Tasks use YAML frontmatter: id, from, to, owner, status, priority, created, updated, title
- Status flow: `pending → in_progress → done` (or `rejected`)
- The hub watches `tasks/` and auto-routes work to roles

## Task ID Generation

**Always** use the CLI to get a unique task ID — never invent one yourself:

```bash
ai-company next-id   # prints e.g. "004", reserves it atomically
```

Call it **once per task** you plan to create. If creating 3 tasks, call it 3 times and collect the IDs before writing any files.

## Task Flow

1. Creator sets `to: <role>`, `from: <me>`, `status: pending`
2. Assignee picks up: `owner: <me>`, `status: in_progress`
3. Assignee finishes: `status: done` (or `rejected` with reason)
````

- [ ] **Step 4: Add cmdInit to bin/ai-company.js**

Add this function before the dispatch section in `bin/ai-company.js`:

```javascript
async function cmdInit(args) {
  const { createInterface } = await import('node:readline/promises')
  const { addProject, getPidPath } = await reg()
  const pidPath = getPidPath()

  const targetDir = resolve(args[0] || process.cwd())
  mkdirSync(targetDir, { recursive: true })

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const defaultName = basename(targetDir)
  const name = (await rl.question(`Project name (${defaultName}): `)).trim() || defaultName
  const goal = (await rl.question('Goal (one sentence): ')).trim() || 'An AI company project'
  const rolesInput = (await rl.question('Roles (pm,engineer,qa): ')).trim() || 'pm,engineer,qa'
  rl.close()

  const roles = rolesInput.split(',').map(r => r.trim()).filter(Boolean)
  const packageRoot = join(__dirname, '..')

  // Build workflow diagram from roles
  const workflow = roles.length <= 3
    ? `human → ${roles.join(' → ')}`
    : `human → ${roles[0]} → ${roles.slice(1).join(', ')}`

  console.log('\nCreating project structure...')

  // company.md from template
  const templateContent = readFileSync(join(packageRoot, 'templates', 'company.md'), 'utf8')
  const companyMd = templateContent
    .replace('{{name}}', name)
    .replace('{{goal}}', goal)
    .replace('{{workflow}}', workflow)
  writeFileSync(join(targetDir, 'company.md'), companyMd)
  console.log('  ✓ company.md')

  mkdirSync(join(targetDir, 'tasks'), { recursive: true })
  mkdirSync(join(targetDir, 'logs'), { recursive: true })

  // Role dirs
  for (const role of roles) {
    const roleDir = join(targetDir, 'roles', role)
    mkdirSync(roleDir, { recursive: true })

    const roleTemplate = join(packageRoot, 'roles', `${role}.md`)
    if (existsSync(roleTemplate)) {
      copyFileSync(roleTemplate, join(roleDir, 'CLAUDE.md'))
    } else {
      writeFileSync(join(roleDir, 'CLAUDE.md'), `# ${role}\n\nYou are the ${role}. Complete tasks assigned to you.\n`)
    }

    const memTemplate = join(packageRoot, 'memories', `${role}.md`)
    if (existsSync(memTemplate)) {
      copyFileSync(memTemplate, join(roleDir, 'memory.md'))
    } else {
      writeFileSync(join(roleDir, 'memory.md'), `# ${role} Memory\n\n## Handoff Notes\n\n`)
    }

    console.log(`  ✓ roles/${role}/CLAUDE.md + memory.md`)
  }

  console.log('\nRegistering project...')
  addProject(name, targetDir)
  console.log(`  ✓ Added to ~/.ai-company/projects.json`)

  const hubRunning = existsSync(pidPath) && (() => {
    try { return isRunning(parseInt(readFileSync(pidPath, 'utf8').trim(), 10)) } catch { return false }
  })()

  if (hubRunning) {
    console.log('\nHub is running — project loaded automatically.')
  } else {
    console.log('\nStart the hub with: ai-company start')
  }
  console.log('Dashboard: http://localhost:4000')
  console.log(`\nNext: ai-company create ${roles[0] ?? 'pm'} "your first goal"`)
}
```

Replace the `commands` dispatch object (near the bottom of the file) with:

```javascript
const commands = {
  init:       () => cmdInit(args),
  start:      () => cmdStart(),
  stop:       () => cmdStop(),
  health:     () => cmdHealth(),
  list:       () => cmdList(),
  register:   () => cmdRegister(args),
  unregister: () => cmdUnregister(args),
  status:     () => cmdStatus(flags),
  tasks:      () => cmdTasks(args, flags),
  'next-id':  () => cmdNextId(flags),
  create:     () => cmdCreate(args, flags),
  send:       () => cmdSend(args, flags),
}
```

Update the usage text to include `init`:

```javascript
console.log(`Usage: ai-company <command> [args]

Hub:        start | stop | health
Projects:   init [dir] | register [dir] | unregister [dir] | list
Tasks:      create <role> <title> | tasks [role] | send <role> "msg" | next-id | status

Options:    --project <name>  (target a specific project from any directory)`)
```

- [ ] **Step 5: Smoke test init (in a temp directory)**

```bash
mkdir -p /tmp/test-company-init && node /Users/cancan/Projects/AICompany/bin/ai-company.js init /tmp/test-company-init
```
Expected: prompts for name/goal/roles, creates files, registers project.

Verify files created:
```bash
ls /tmp/test-company-init/
ls /tmp/test-company-init/roles/
```
Expected: `company.md`, `tasks/`, `logs/`, `roles/pm/`, `roles/engineer/`, `roles/qa/`

- [ ] **Step 6: Commit**

```bash
git add roles/ memories/ templates/ bin/ai-company.js
git commit -m "feat: add role/memory templates and init command to ai-company CLI"
```

---

## Chunk 2: Server and Dashboard

> **Depends on Chunk 1:** `getNextId` must exist in `bin/lib/task-parser.js` (added by Task 2) and `bin/lib/project-registry.js` must exist (added by Task 1). Complete all Chunk 1 tasks before starting Chunk 2.

### Task 5: Updated bin/lib/web-server.js — multi-project API

**Files:**
- Modify: `bin/lib/web-server.js`
- Modify: `test/web-server.test.js`

The web server's signature changes from `(roleManager, taskStore, logger, opts)` to `(projectStore, opts)` where `projectStore` provides all projects' data.

- [ ] **Step 1: Write failing tests for new API**

Replace `test/web-server.test.js` with:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createWebServer } from '../bin/lib/web-server.js'
import { createLogger } from '../bin/lib/logger.js'
import { createRoleManager } from '../bin/lib/role-manager.js'

function makeProject(name) {
  const logger = createLogger()
  logger.add('info', 'engineer', `log for ${name}`)

  const roleManager = createRoleManager(
    ['engineer', 'pm'],
    async () => ({ sessionId: 'sess', resultStatus: 'done' }),
    () => null,
    logger
  )

  const taskStore = {
    getAll: () => [
      { id: '001', title: 'Task A', from: 'human', to: 'engineer', owner: null, status: 'pending', priority: 'high', created: '2026-03-14', updated: '2026-03-14' }
    ]
  }

  return { name, path: `/tmp/${name}`, status: 'active', logger, roleManager, taskStore }
}

function makeProjectStore(projects) {
  const map = new Map(projects.map(p => [p.name, p]))
  return {
    getProjects: () => [...map.values()].map(({ name, path, status }) => ({ name, path, status })),
    getProject: (name) => map.get(name) ?? null
  }
}

async function request(server, path, method = 'GET') {
  const { address, port } = server.address()
  const url = `http://${address === '::' ? 'localhost' : address}:${port}${path}`
  const res = await fetch(url, { method })
  return { status: res.status, body: await res.json() }
}

test('GET /api/projects returns all projects', async (t) => {
  const store = makeProjectStore([makeProject('Alpha'), makeProject('Beta')])
  const server = createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status, body } = await request(server, '/api/projects')
  assert.equal(status, 200)
  assert.equal(body.length, 2)
  assert.ok(body.find(p => p.name === 'Alpha'))
})

test('GET /api/status?project=Alpha returns roles for that project', async (t) => {
  const store = makeProjectStore([makeProject('Alpha')])
  const server = createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status, body } = await request(server, '/api/status?project=Alpha')
  assert.equal(status, 200)
  assert.equal(body.project, 'Alpha')
  assert.ok(body.roles.engineer)
  assert.equal(body.roles.engineer.state, 'free')
})

test('GET /api/status without project returns 400', async (t) => {
  const store = makeProjectStore([makeProject('Alpha')])
  const server = createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status } = await request(server, '/api/status')
  assert.equal(status, 400)
})

test('GET /api/status for unknown project returns 404', async (t) => {
  const store = makeProjectStore([makeProject('Alpha')])
  const server = createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status } = await request(server, '/api/status?project=Unknown')
  assert.equal(status, 404)
})

test('GET /api/tasks?project=Alpha returns tasks', async (t) => {
  const store = makeProjectStore([makeProject('Alpha')])
  const server = createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status, body } = await request(server, '/api/tasks?project=Alpha')
  assert.equal(status, 200)
  assert.equal(body.length, 1)
  assert.equal(body[0].id, '001')
})

test('GET /api/logs?project=Alpha returns logs', async (t) => {
  const store = makeProjectStore([makeProject('Alpha')])
  const server = createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status, body } = await request(server, '/api/logs?project=Alpha')
  assert.equal(status, 200)
  assert.equal(body.length, 1)
  assert.equal(body[0].message, 'log for Alpha')
})

test('POST /api/next-id?project=Alpha returns reserved ID', async (t) => {
  const { mkdirSync, rmSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { tmpdir } = await import('node:os')

  // The server computes `join(project.path, 'tasks')` — so use a real temp project dir
  const tmpProjectDir = join(tmpdir(), `proj-ws-test-${Date.now()}`)
  mkdirSync(join(tmpProjectDir, 'tasks'), { recursive: true })
  t.after(() => rmSync(tmpProjectDir, { recursive: true, force: true }))

  const proj = makeProject('Alpha')
  const store = {
    getProjects: () => [{ name: 'Alpha', path: tmpProjectDir, status: 'active' }],
    getProject: (name) => name === 'Alpha' ? { ...proj, path: tmpProjectDir, status: 'active' } : null
  }

  const server = createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status, body } = await request(server, '/api/next-id?project=Alpha', 'POST')
  assert.equal(status, 200)
  assert.match(body.id, /^\d{3}$/)
})
```

- [ ] **Step 2: Run to verify tests fail (old API)**

```bash
node --test test/web-server.test.js 2>&1 | head -30
```
Expected: failures — old `createWebServer` signature doesn't match new test.

- [ ] **Step 3: Rewrite bin/lib/web-server.js**

Replace `bin/lib/web-server.js` with:

```javascript
import express from 'express'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getNextId } from './task-parser.js'
import { mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function createWebServer(projectStore, { port = 4000 } = {}) {
  const app = express()

  // Dashboard and root redirect
  app.use('/dashboard', express.static(join(__dirname, '../dashboard')))
  app.get('/', (req, res) => res.redirect('/dashboard'))

  // Helper: resolve project from ?project= query param, send error if invalid
  function requireProject(req, res) {
    const name = req.query.project
    if (!name) {
      res.status(400).json({ error: 'project query parameter required' })
      return null
    }
    const project = projectStore.getProject(name)
    if (!project) {
      res.status(404).json({ error: `project '${name}' not found` })
      return null
    }
    if (project.status === 'offline') {
      res.status(503).json({ error: `project '${name}' is offline` })
      return null
    }
    return project
  }

  app.get('/api/projects', (req, res) => {
    res.json(projectStore.getProjects())
  })

  app.get('/api/status', (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    res.json({ project: project.name, roles: project.roleManager.getStatus() })
  })

  app.get('/api/tasks', (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    res.json(project.taskStore.getAll())
  })

  app.get('/api/logs', (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    const limit = parseInt(req.query.limit ?? '50', 10)
    res.json(project.logger.get(limit))
  })

  app.post('/api/next-id', (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    const tasksDir = join(project.path, 'tasks')
    mkdirSync(tasksDir, { recursive: true })
    const id = getNextId(tasksDir)
    res.json({ id })
  })

  const server = app.listen(port)
  server.on('error', (err) => {
    console.error(`Web server error: ${err.message}`)
    process.exit(1)
  })
  return server
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
node --test test/web-server.test.js
```
Expected: 7 tests passing.

- [ ] **Step 5: Run all tests to check nothing regressed**

```bash
node --test test/**/*.test.js
```
Expected: all tests pass (logger, task-parser, role-manager, web-server, project-registry).

- [ ] **Step 6: Commit**

```bash
git add bin/lib/web-server.js test/web-server.test.js
git commit -m "feat: update web-server to multi-project API with projectStore interface"
```

---

### Task 6: Updated bin/company-server.js — multi-project hub

**Files:**
- Modify: `bin/company-server.js`

- [ ] **Step 1: Read the current company-server.js**

Read `bin/company-server.js` in full before editing (already done above, but re-read to ensure accuracy).

- [ ] **Step 2: Rewrite bin/company-server.js**

Replace `bin/company-server.js` with:

```javascript
#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import chokidar from 'chokidar'
import { createLogger }      from './lib/logger.js'
import { createRoleManager } from './lib/role-manager.js'
import { createSdkRunner }   from './lib/sdk-runner.js'
import { createFileWatcher } from './lib/file-watcher.js'
import { createWebServer }   from './lib/web-server.js'
import { buildTaskList, readTaskFile } from './lib/task-parser.js'
import { readRegistry, getRegistryDir, getRegistryPath, getPidPath } from './lib/project-registry.js'

// Map of project name → active project state
// Each entry: { name, path, status: 'active'|'offline', logger, roleManager, taskStore, watcher }
const activeProjects = new Map()

function loadRoles(projectPath) {
  const rolesDir = join(projectPath, 'roles')
  if (!existsSync(rolesDir)) return []
  return readdirSync(rolesDir)
    .filter(name => !name.startsWith('.') && statSync(join(rolesDir, name)).isDirectory())
}

async function activateProject({ name, path }) {
  if (!existsSync(path)) {
    console.warn(`[hub] Project '${name}' path not found: ${path} — marking offline`)
    activeProjects.set(name, { name, path, status: 'offline' })
    return
  }

  const roles = loadRoles(path)
  const logger = createLogger()
  const sessionsPath = join(path, 'roles', '.sessions.json')
  const tasksDir = join(path, 'tasks')
  const logsDir = join(path, 'logs')

  mkdirSync(tasksDir, { recursive: true })
  mkdirSync(logsDir, { recursive: true })

  // Note: spec says "share one SDKRunner" but the current createSdkRunner API takes projectDir
  // and sessionsPath at construction time, making it project-scoped by design. Per-project
  // instances are used here; refactoring to a truly shared runner is future work.
  const sdkRunner = createSdkRunner(path, sessionsPath)
  const roleManager = createRoleManager(roles, sdkRunner, readTaskFile, logger)

  if (existsSync(sessionsPath)) {
    try {
      const sessions = JSON.parse(readFileSync(sessionsPath, 'utf8'))
      roleManager.loadSessions(sessions)
      logger.add('info', null, `loaded sessions for: ${Object.keys(sessions).join(', ')}`)
    } catch {}
  }

  const taskStore = { getAll: () => buildTaskList(tasksDir) }
  const watcher = createFileWatcher(tasksDir, roleManager, logger)

  activeProjects.set(name, { name, path, status: 'active', logger, roleManager, taskStore, watcher })
  logger.add('info', null, `project '${name}' activated`)
  console.log(`[hub] Activated project: ${name}`)
}

function deactivateProject(name) {
  const project = activeProjects.get(name)
  if (!project) return
  if (project.status === 'active') {
    project.watcher.close()
    // RoleManager drain: no new dispatches; running agents finish naturally
  }
  activeProjects.delete(name)
  console.log(`[hub] Deactivated project: ${name}`)
}

async function syncRegistry() {
  const registered = readRegistry()
  const registeredMap = new Map(registered.map(p => [p.name, p]))

  // Deactivate projects no longer in registry
  for (const [name] of activeProjects) {
    if (!registeredMap.has(name)) deactivateProject(name)
  }

  // Activate new or path-changed projects
  for (const project of registered) {
    const existing = activeProjects.get(project.name)
    if (!existing) {
      await activateProject(project)
    } else if (existing.path !== project.path) {
      deactivateProject(project.name)
      await activateProject(project)
    }
  }
}

const projectStore = {
  getProjects: () => [...activeProjects.values()].map(({ name, path, status }) => ({ name, path, status })),
  getProject:  (name) => activeProjects.get(name) ?? null
}

async function main() {
  const registryDir = getRegistryDir()
  const registryPath = getRegistryPath()
  const pidPath = getPidPath()

  mkdirSync(registryDir, { recursive: true })

  // Initial project load
  await syncRegistry()

  if (activeProjects.size === 0) {
    console.warn('[hub] No registered projects. Run: ai-company init')
  }

  // Watch registry file for hot-reload (new/removed projects)
  const registryWatcher = chokidar.watch(registryDir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
  })
  // Handle both 'change' (updates) and 'add' (first-time creation when hub starts before init)
  registryWatcher.on('all', (event, filepath) => {
    if ((event === 'add' || event === 'change') && filepath === registryPath) {
      console.log('[hub] Registry changed — syncing projects...')
      syncRegistry().catch(err => console.error('[hub] sync error:', err.message))
    }
  })

  const webServer = createWebServer(projectStore, { port: 4000 })

  writeFileSync(pidPath, String(process.pid))
  console.log(`AI Company hub running — dashboard: http://localhost:4000`)
  console.log(`Managing ${activeProjects.size} project(s): ${[...activeProjects.keys()].join(', ') || 'none'}`)

  function shutdown() {
    console.log('[hub] shutting down')
    registryWatcher.close()
    for (const [name] of activeProjects) deactivateProject(name)
    webServer.close()
    try { unlinkSync(pidPath) } catch {}
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1) })
```

- [ ] **Step 3: Verify syntax**

```bash
node --check bin/company-server.js
```
Expected: no output (no syntax errors).

- [ ] **Step 4: Smoke test with a real project registered**

```bash
# Register the current AICompany project itself
node bin/ai-company.js register .

# Start the hub
node bin/ai-company.js start

# Wait 2s then check health
sleep 2 && node bin/ai-company.js health
```
Expected: `Server PID: <n> (alive)` and `Dashboard: http://localhost:4000`.

Open `http://localhost:4000` in browser — should redirect to `/dashboard/`.

- [ ] **Step 5: Stop server**

```bash
node bin/ai-company.js stop
```

- [ ] **Step 6: Commit**

```bash
git add bin/company-server.js
git commit -m "feat: rewrite company-server as multi-project hub with registry hot-reload"
```

---

### Task 7: Updated bin/dashboard/index.html — multi-project UI

**Files:**
- Modify: `bin/dashboard/index.html`

- [ ] **Step 1: Rewrite bin/dashboard/index.html**

Replace the entire file with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Company</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #e6edf3; min-height: 100vh; display: flex; flex-direction: column; }
    header { background: #161b22; border-bottom: 1px solid #30363d; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; }
    header h1 { font-size: 16px; font-weight: 600; }
    #refresh-info { font-size: 12px; color: #8b949e; }
    #alert-banner { display: none; background: #3d1414; border-left: 4px solid #f85149; padding: 10px 24px; font-size: 13px; color: #ffa198; }
    #layout { display: flex; flex: 1; overflow: hidden; }

    /* Sidebar */
    #sidebar { width: 200px; min-width: 200px; background: #161b22; border-right: 1px solid #30363d; padding: 16px 0; overflow-y: auto; }
    #sidebar h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8b949e; padding: 0 16px 8px; }
    .project-item { padding: 8px 16px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 8px; border-left: 3px solid transparent; }
    .project-item:hover { background: #21262d; }
    .project-item.active { background: #21262d; border-left-color: #58a6ff; color: #58a6ff; }
    .project-item.offline { color: #8b949e; }
    .project-dot { width: 7px; height: 7px; border-radius: 50%; background: #30363d; flex-shrink: 0; }
    .project-dot.working { background: #ffa657; }
    .project-dot.waiting { background: #f85149; }
    .project-dot.active-proj { background: #3fb950; }

    /* Main content */
    #main { flex: 1; overflow-y: auto; padding: 20px 24px; }
    #project-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #e6edf3; }
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
    #empty-state { color: #8b949e; font-size: 14px; padding: 40px 0; }
  </style>
</head>
<body>
  <header>
    <h1>AI Company</h1>
    <span id="refresh-info">refreshing every 3s</span>
  </header>

  <div id="alert-banner"></div>

  <div id="layout">
    <aside id="sidebar">
      <h3>Projects</h3>
      <ul id="project-list" style="list-style:none"></ul>
    </aside>

    <div id="main">
      <div id="project-title"></div>

      <div id="empty-state" style="display:none">
        No projects registered. Run: <code>ai-company init</code>
      </div>

      <section id="roles-section">
        <h2>Roles</h2>
        <div id="role-cards"></div>
      </section>

      <section>
        <h2>Tasks</h2>
        <table>
          <thead><tr><th>ID</th><th>Title</th><th>From</th><th>To</th><th>Owner</th><th>Status</th><th>Priority</th></tr></thead>
          <tbody id="task-rows"></tbody>
        </table>
      </section>

      <section>
        <h2>Log</h2>
        <div id="log-box"></div>
      </section>
    </div>
  </div>

  <script>
    let selectedProject = null

    async function fetchJson(url) {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return res.json()
    }

    function dotClass(project) {
      // /api/projects does not return per-role states, so dot indicates online/offline only.
      // (The .working and .waiting CSS classes are reserved for a future enhancement where the
      // sidebar fetches /api/status per project and aggregates role states into a single indicator.)
      return project.status === 'offline' ? '' : 'active-proj'
    }

    function renderSidebar(projects) {
      const list = document.getElementById('project-list')
      list.innerHTML = projects.map(p => `
        <li class="project-item ${p.status === 'offline' ? 'offline' : ''} ${p.name === selectedProject ? 'active' : ''}"
            onclick="selectProject('${p.name}')">
          <span class="project-dot ${dotClass(p)}"></span>
          ${p.name}
        </li>`).join('')

      document.getElementById('empty-state').style.display = projects.length === 0 ? 'block' : 'none'
      document.getElementById('roles-section').style.display = projects.length === 0 ? 'none' : ''
    }

    function selectProject(name) {
      selectedProject = name
      document.getElementById('project-title').textContent = name
      refresh()
    }

    function stateLabel(s) {
      return { free: '✓ free', working: '⟳ working', waiting_human: '⚠ waiting', ready: '✓ ready' }[s] || s
    }

    function renderRoles(projectName, roles) {
      const container = document.getElementById('role-cards')
      const waiting = []
      container.innerHTML = Object.entries(roles).map(([name, r]) => {
        if (r.state === 'waiting_human') waiting.push({ project: projectName, role: name, task: r.activeTask })
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
          `<strong>${w.project} › ${w.role}</strong>${w.task ? ` on #${w.task.id} "${w.task.title}"` : ''}`
        ).join(', ') + ` — run <code>ai-company send ${waiting[0].role} "your message"</code>`
      } else {
        banner.style.display = 'none'
      }
    }

    function renderTasks(tasks) {
      document.getElementById('task-rows').innerHTML = tasks.map(t => `
        <tr>
          <td style="color:#8b949e">${t.id}</td>
          <td>${t.title}</td>
          <td style="color:#8b949e">${t.from ?? '-'}</td>
          <td>${t.to ?? '-'}</td>
          <td style="color:#8b949e">${t.owner ?? '-'}</td>
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
        const projects = await fetchJson('/api/projects')
        renderSidebar(projects)

        // Auto-select first active project if none selected
        if (!selectedProject && projects.length > 0) {
          const first = projects.find(p => p.status === 'active') ?? projects[0]
          selectedProject = first.name
          document.getElementById('project-title').textContent = first.name
        }

        if (selectedProject) {
          const enc = encodeURIComponent(selectedProject)
          const [statusData, tasks, logs] = await Promise.all([
            fetchJson(`/api/status?project=${enc}`),
            fetchJson(`/api/tasks?project=${enc}`),
            fetchJson(`/api/logs?project=${enc}&limit=50`)
          ])
          renderRoles(selectedProject, statusData.roles)
          renderTasks(tasks)
          renderLogs(logs)
        }

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

- [ ] **Step 2: Smoke test the dashboard**

```bash
node bin/ai-company.js start
```

Open `http://localhost:4000` — should see the two-panel layout with the sidebar on the left and the current project's roles/tasks/logs on the right.

Verify:
- Project sidebar shows registered projects
- Clicking a project switches the main panel
- Role cards show for the selected project
- Logs update every 3s

- [ ] **Step 3: Stop server and run all tests**

```bash
node bin/ai-company.js stop
node --test test/**/*.test.js
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add bin/dashboard/index.html
git commit -m "feat: update dashboard to multi-project UI with project sidebar"
```
