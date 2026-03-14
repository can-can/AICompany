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

  try {
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
  } catch (err) {
    console.error(`[hub] Failed to activate project '${name}': ${err.message}`)
    activeProjects.set(name, { name, path, status: 'offline' })
  }
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

let syncPromise = Promise.resolve()

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
      syncPromise = syncPromise.then(() => syncRegistry()).catch(err => console.error('[hub] sync error:', err.message))
    }
  })

  const webServer = createWebServer(projectStore, { port: 4000 })

  writeFileSync(pidPath, String(process.pid))
  console.log(`AI Company hub running — dashboard: http://localhost:4000`)
  console.log(`Managing ${activeProjects.size} project(s): ${[...activeProjects.keys()].join(', ') || 'none'}`)

  function shutdown() {
    console.log('[hub] shutting down')
    registryWatcher.close()
    for (const name of [...activeProjects.keys()]) deactivateProject(name)
    webServer.close()
    try { unlinkSync(pidPath) } catch {}
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1) })
