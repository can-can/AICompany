import express from 'express'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getNextId } from './task-parser.js'
import { mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function createWebServer(projectStore, { port = 4000 } = {}) {
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
  server.on('error', (err) => {
    console.error(`Web server error: ${err.message}`)
  })
  return server
}
