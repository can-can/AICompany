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
Projects:   register [dir] | unregister [dir] | list
Tasks:      create <role> <title> | tasks [role] | send <role> "msg" | next-id | status

Options:    --project <name>  (target a specific project from any directory)`)
  process.exit(command ? 1 : 0)
}

commands[command]().catch(err => { console.error(err.message); process.exit(1) })
