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

async function request(server, path, method = 'GET', jsonBody) {
  const { address, port } = server.address()
  const url = `http://${address === '::' ? 'localhost' : address}:${port}${path}`
  const opts = { method }
  if (jsonBody !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' }
    opts.body = JSON.stringify(jsonBody)
  }
  const res = await fetch(url, opts)
  return { status: res.status, body: await res.json() }
}

test('GET /api/projects returns all projects', async (t) => {
  const store = makeProjectStore([makeProject('Alpha'), makeProject('Beta')])
  const server = await createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status, body } = await request(server, '/api/projects')
  assert.equal(status, 200)
  assert.equal(body.length, 2)
  assert.ok(body.find(p => p.name === 'Alpha'))
})

test('GET /api/status?project=Alpha returns roles for that project', async (t) => {
  const store = makeProjectStore([makeProject('Alpha')])
  const server = await createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status, body } = await request(server, '/api/status?project=Alpha')
  assert.equal(status, 200)
  assert.equal(body.project, 'Alpha')
  assert.ok(body.roles.engineer)
  assert.equal(body.roles.engineer.state, 'free')
})

test('GET /api/status without project returns 400', async (t) => {
  const store = makeProjectStore([makeProject('Alpha')])
  const server = await createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status } = await request(server, '/api/status')
  assert.equal(status, 400)
})

test('GET /api/status for unknown project returns 404', async (t) => {
  const store = makeProjectStore([makeProject('Alpha')])
  const server = await createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status } = await request(server, '/api/status?project=Unknown')
  assert.equal(status, 404)
})

test('GET /api/status for offline project returns 503', async (t) => {
  const offlineProject = { ...makeProject('Offline'), status: 'offline' }
  const store = makeProjectStore([offlineProject])
  const server = await createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status } = await request(server, '/api/status?project=Offline')
  assert.equal(status, 503)
})

test('GET /api/tasks?project=Alpha returns tasks', async (t) => {
  const store = makeProjectStore([makeProject('Alpha')])
  const server = await createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status, body } = await request(server, '/api/tasks?project=Alpha')
  assert.equal(status, 200)
  assert.equal(body.length, 1)
  assert.equal(body[0].id, '001')
})

test('GET /api/logs?project=Alpha returns logs', async (t) => {
  const store = makeProjectStore([makeProject('Alpha')])
  const server = await createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status, body } = await request(server, '/api/logs?project=Alpha')
  assert.equal(status, 200)
  assert.equal(body.length, 1)
  assert.equal(body[0].message, 'log for Alpha')
})

test('GET /api/logs?limit=1 returns at most 1 entry', async (t) => {
  const proj = makeProject('Alpha')
  // makeProject already added 1 log entry; add a second so limit is meaningful
  proj.logger.add('info', 'pm', 'second log for Alpha')
  const store = makeProjectStore([proj])
  const server = await createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status, body } = await request(server, '/api/logs?project=Alpha&limit=1')
  assert.equal(status, 200)
  assert.equal(body.length, 1)
})

test('POST /api/send?project=Alpha delivers message to role', async (t) => {
  const store = makeProjectStore([makeProject('Alpha')])
  const server = await createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status, body } = await request(server, '/api/send?project=Alpha', 'POST', { role: 'engineer', message: 'hello' })
  assert.equal(status, 200)
  assert.equal(body.ok, true)
})

test('POST /api/send without role returns 400', async (t) => {
  const store = makeProjectStore([makeProject('Alpha')])
  const server = await createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status } = await request(server, '/api/send?project=Alpha', 'POST', { message: 'hello' })
  assert.equal(status, 400)
})

test('POST /api/send with unknown role returns 400', async (t) => {
  const store = makeProjectStore([makeProject('Alpha')])
  const server = await createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status } = await request(server, '/api/send?project=Alpha', 'POST', { role: 'unknown', message: 'hello' })
  assert.equal(status, 400)
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

  const server = await createWebServer(store, { port: 0 })
  t.after(() => new Promise(r => server.close(r)))

  const { status, body } = await request(server, '/api/next-id?project=Alpha', 'POST')
  assert.equal(status, 200)
  assert.match(body.id, /^\d{3}$/)
})
