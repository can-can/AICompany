import express from 'express'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function createWebServer(roleManager, taskStore, logger, { port = 4000 } = {}) {
  const app = express()

  // Serve the public homepage at the root
  app.use(express.static(join(__dirname, '../../public')))

  // Serve the internal dashboard under /dashboard/
  app.use('/dashboard', express.static(join(__dirname, '../dashboard')))

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
  server.on('error', (err) => {
    console.error(`Web server error: ${err.message}`)
    process.exit(1)
  })
  return server
}
