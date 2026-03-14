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
