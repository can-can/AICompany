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
    const rawLimit = parseInt(req.query.limit ?? '50', 10)
    const limit = isNaN(rawLimit) ? 50 : rawLimit
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
  })
  return server
}
