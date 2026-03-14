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
