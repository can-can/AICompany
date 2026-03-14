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
