import express from 'express'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getNextId, buildTaskList, readTaskFileWithBody, updateTaskStatus } from './task-parser.js'
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function createWebServer(projectStore, { port = 4000 } = {}) {
  const app = express()

  app.use(express.json())

  // Serve React dashboard from built output
  app.use(express.static(join(__dirname, '..', '..', 'dashboard', 'dist')))

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
    const rawLimit = parseInt(req.query.limit ?? '50', 10)
    const limit = isNaN(rawLimit) ? 50 : rawLimit
    res.json(project.logger.get(limit))
  })

  app.post('/api/send', (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    const { role, message } = req.body ?? {}
    if (!role || !message) {
      res.status(400).json({ error: 'role and message are required' })
      return
    }
    try {
      project.roleManager.sendInput(role, message)
      res.json({ ok: true })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  app.post('/api/stop', (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    const { role } = req.body ?? {}
    if (!role) {
      res.status(400).json({ error: 'role is required' })
      return
    }
    try {
      const stopped = project.roleManager.stopAgent(role)
      res.json({ ok: true, stopped })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  app.delete('/api/conversation', (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    const { role } = req.query
    if (!role) {
      res.status(400).json({ error: 'role query parameter required' })
      return
    }
    try {
      const cleared = project.roleManager.clearConversation(role)
      res.json({ ok: true, cleared })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  // --- Memory management ---

  const ALLOWED_MEMORY_PATTERNS = [
    /^company\.md$/,
    /^roles\/[a-zA-Z0-9_-]+\/CLAUDE\.md$/,
    /^roles\/[a-zA-Z0-9_-]+\/memory\.md$/,
  ]

  function isAllowedMemoryPath(p) {
    if (p.includes('..')) return false
    return ALLOWED_MEMORY_PATTERNS.some(re => re.test(p))
  }

  app.get('/api/memory', (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    const files = []
    const root = project.path

    // company.md
    const companyPath = join(root, 'company.md')
    if (existsSync(companyPath)) {
      files.push({ path: 'company.md', content: readFileSync(companyPath, 'utf-8') })
    }

    // roles/*/CLAUDE.md and roles/*/memory.md
    const rolesDir = join(root, 'roles')
    if (existsSync(rolesDir)) {
      for (const role of readdirSync(rolesDir, { withFileTypes: true })) {
        if (!role.isDirectory()) continue
        for (const filename of ['CLAUDE.md', 'memory.md']) {
          const filePath = join(rolesDir, role.name, filename)
          if (existsSync(filePath)) {
            files.push({
              path: `roles/${role.name}/${filename}`,
              content: readFileSync(filePath, 'utf-8'),
            })
          }
        }
      }
    }

    res.json({ files })
  })

  app.put('/api/memory', (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    const { path: filePath, content } = req.body ?? {}
    if (!filePath || typeof content !== 'string') {
      res.status(400).json({ error: 'path and content are required' })
      return
    }
    if (!isAllowedMemoryPath(filePath)) {
      res.status(400).json({ error: 'invalid memory file path' })
      return
    }
    try {
      const fullPath = join(project.path, filePath)
      writeFileSync(fullPath, content, 'utf-8')
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // --- Tasks ---

  app.get('/api/task', (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    const { id } = req.query
    if (!id) {
      res.status(400).json({ error: 'id query parameter required' })
      return
    }
    const tasksDir = join(project.path, 'tasks')
    const tasks = buildTaskList(tasksDir)
    const task = tasks.find(t => t.id === id)
    if (!task) {
      res.status(404).json({ error: `task '${id}' not found` })
      return
    }
    const detail = readTaskFileWithBody(task.filepath)
    if (!detail) {
      res.status(404).json({ error: `task '${id}' not found` })
      return
    }
    res.json(detail)
  })

  app.patch('/api/task/status', (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    const { id, status } = req.body ?? {}
    if (!id || !status) {
      res.status(400).json({ error: 'id and status are required' })
      return
    }
    const validStatuses = ['pending', 'in_progress', 'done', 'rejected']
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `invalid status, must be one of: ${validStatuses.join(', ')}` })
      return
    }
    const tasksDir = join(project.path, 'tasks')
    const tasks = buildTaskList(tasksDir)
    const task = tasks.find(t => t.id === id)
    if (!task) {
      res.status(404).json({ error: `task '${id}' not found` })
      return
    }
    try {
      updateTaskStatus(task.filepath, status)
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/next-id', (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    const tasksDir = join(project.path, 'tasks')
    mkdirSync(tasksDir, { recursive: true })
    const id = getNextId(tasksDir)
    res.json({ id })
  })

  app.get('/api/conversation', async (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    const { role, limit, before } = req.query
    if (!role) {
      res.status(400).json({ error: 'role query parameter required' })
      return
    }
    const sessions = project.roleManager.getSessions()
    const sessionId = sessions[role]
    if (!sessionId) {
      res.json({ messages: [], hasMore: false })
      return
    }
    try {
      const { getSessionMessages } = await import('@anthropic-ai/claude-agent-sdk')
      const { createConversationReader } = await import('./conversation-reader.js')
      const reader = createConversationReader(getSessionMessages)
      const parsedLimit = parseInt(limit ?? '10', 10)
      const result = await reader.readPage(sessionId, {
        limit: isNaN(parsedLimit) ? 10 : parsedLimit,
        before: before || undefined,
      })
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/conversation/stream', (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    const { role } = req.query
    if (!role) {
      res.status(400).json({ error: 'role query parameter required' })
      return
    }

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.flushHeaders()

    // Send initial connection event with current state
    const initialState = project.roleManager.getState(role)
    res.write(`data: ${JSON.stringify({ type: 'connected', state: initialState })}\n\n`)

    // Subscribe to role-manager's emitter for real-time messages
    const onMessage = (evt) => {
      if (evt.role !== role) return
      res.write(`data: ${JSON.stringify(evt)}\n\n`)
    }
    project.roleManager.emitter.on('message', onMessage)

    // Periodic state pings so dashboard knows when agent starts/stops
    const statusInterval = setInterval(() => {
      try {
        const state = project.roleManager.getState(role)
        res.write(`data: ${JSON.stringify({ type: 'state', state })}\n\n`)
      } catch {
        // role may not exist anymore
      }
    }, 2000)

    // Cleanup on disconnect
    req.on('close', () => {
      project.roleManager.emitter.off('message', onMessage)
      clearInterval(statusInterval)
    })
  })

  // SPA fallback — must be last route
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', '..', 'dashboard', 'dist', 'index.html'))
  })

  const server = app.listen(port, '0.0.0.0')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  return server
}
