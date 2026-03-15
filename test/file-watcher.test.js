import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createFileWatcher } from '../bin/lib/file-watcher.js'

function makeLogger() {
  const entries = []
  return { add: (level, role, msg) => entries.push({ level, role, msg }), entries }
}

function waitMs(ms) {
  return new Promise(r => setTimeout(r, ms))
}

test('file watcher enqueues pending task', async (t) => {
  const dir = join(tmpdir(), `fw-test-${Date.now()}-a`)
  mkdirSync(dir, { recursive: true })
  const logger = makeLogger()
  const enqueued = []
  const dispatched = []
  const roleManager = {
    enqueue: (task) => enqueued.push(task),
    scheduleDispatch: (role) => dispatched.push(role)
  }

  const watcher = createFileWatcher(dir, roleManager, logger)
  t.after(async () => { await watcher.close(); rmSync(dir, { recursive: true, force: true }) })

  // Wait for watcher to be ready
  await waitMs(300)

  writeFileSync(join(dir, '001-test.md'), `---\nid: "001"\ntitle: "Test"\nstatus: pending\nfrom: human\nto: engineer\npriority: medium\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\n`)

  await waitMs(500)
  assert.ok(enqueued.length > 0, 'should have enqueued a task')
  assert.equal(enqueued[0].id, '001')
})

test('file watcher dispatches on done task', async (t) => {
  const dir = join(tmpdir(), `fw-test-${Date.now()}-b`)
  mkdirSync(dir, { recursive: true })
  const logger = makeLogger()
  const enqueued = []
  const dispatched = []
  const roleManager = {
    enqueue: (task) => enqueued.push(task),
    scheduleDispatch: (role) => dispatched.push(role)
  }

  const watcher = createFileWatcher(dir, roleManager, logger)
  t.after(async () => { await watcher.close(); rmSync(dir, { recursive: true, force: true }) })

  await waitMs(300)

  writeFileSync(join(dir, '002-done.md'), `---\nid: "002"\ntitle: "Done task"\nstatus: done\nfrom: pm\nto: engineer\npriority: medium\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\n`)

  await waitMs(500)
  assert.ok(dispatched.includes('engineer'), 'should dispatch to-role')
  assert.ok(dispatched.includes('pm'), 'should dispatch from-role')
})
