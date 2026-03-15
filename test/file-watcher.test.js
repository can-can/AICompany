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

test('file watcher skips done tasks during initial scan', async (t) => {
  const dir = join(tmpdir(), `fw-test-${Date.now()}-c`)
  mkdirSync(dir, { recursive: true })

  // Write a done task BEFORE starting the watcher
  writeFileSync(join(dir, '003-old.md'), `---\nid: "003"\ntitle: "Old done"\nstatus: done\nfrom: pm\nto: engineer\npriority: medium\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\n`)

  const logger = makeLogger()
  const dispatched = []
  const roleManager = {
    enqueue: () => {},
    scheduleDispatch: (role) => dispatched.push(role)
  }

  const watcher = createFileWatcher(dir, roleManager, logger)
  t.after(async () => { await watcher.close(); rmSync(dir, { recursive: true, force: true }) })

  await waitMs(500)
  assert.equal(dispatched.length, 0, 'should NOT dispatch for done tasks found during initial scan')
})

test('file watcher does not re-dispatch for same done task', async (t) => {
  const dir = join(tmpdir(), `fw-test-${Date.now()}-d`)
  mkdirSync(dir, { recursive: true })
  const logger = makeLogger()
  const dispatched = []
  const roleManager = {
    enqueue: () => {},
    scheduleDispatch: (role) => dispatched.push(role)
  }

  const watcher = createFileWatcher(dir, roleManager, logger)
  t.after(async () => { await watcher.close(); rmSync(dir, { recursive: true, force: true }) })

  await waitMs(300)

  const taskContent = `---\nid: "004"\ntitle: "Task"\nstatus: done\nfrom: pm\nto: engineer\npriority: medium\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\n`
  writeFileSync(join(dir, '004-task.md'), taskContent)
  await waitMs(500)

  const firstCount = dispatched.length
  assert.ok(firstCount > 0, 'should dispatch on first done event')

  // Touch the file again — should NOT dispatch again
  writeFileSync(join(dir, '004-task.md'), taskContent + '\n')
  await waitMs(500)

  assert.equal(dispatched.length, firstCount, 'should NOT re-dispatch for same done task')
})
