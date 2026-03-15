import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readTaskFile, buildTaskList, priorityOrder, getNextId, parseFrontmatter } from '../bin/lib/task-parser.js'

const TMP = '/tmp/ai-company-test-tasks'

test.before(() => mkdirSync(TMP, { recursive: true }))
test.after(() => rmSync(TMP, { recursive: true, force: true }))

function writeTask(name, content) {
  writeFileSync(join(TMP, name), content)
  return join(TMP, name)
}

test('readTaskFile parses valid frontmatter', () => {
  const path = writeTask('001-test.md', `---
id: "001"
title: "Build auth"
status: pending
from: human
to: engineer
owner:
priority: high
created: 2026-03-13
updated: 2026-03-13
---

## Objective
Build auth
`)
  const task = readTaskFile(path)
  assert.equal(task.id, '001')
  assert.equal(task.title, 'Build auth')
  assert.equal(task.status, 'pending')
  assert.equal(task.from, 'human')
  assert.equal(task.to, 'engineer')
  assert.equal(task.priority, 'high')
  assert.equal(task.filepath, path)
})

test('readTaskFile returns null for missing file', () => {
  const result = readTaskFile('/tmp/does-not-exist.md')
  assert.equal(result, null)
})

test('readTaskFile returns null for malformed frontmatter', () => {
  const path = writeTask('bad.md', 'no frontmatter here')
  const result = readTaskFile(path)
  assert.equal(result, null)
})

test('priorityOrder sorts high before medium before low', () => {
  assert.ok(priorityOrder('high') < priorityOrder('medium'))
  assert.ok(priorityOrder('medium') < priorityOrder('low'))
  assert.ok(priorityOrder('low') < priorityOrder('unknown'))
})

test('buildTaskList returns tasks sorted by priority then created', () => {
  rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  writeTask('002-b.md', `---
id: "002"
title: "Task B"
status: pending
from: human
to: engineer
owner:
priority: medium
created: 2026-03-13
updated: 2026-03-13
---
`)
  writeTask('003-c.md', `---
id: "003"
title: "Task C"
status: pending
from: human
to: engineer
owner:
priority: high
created: 2026-03-14
updated: 2026-03-14
---
`)
  const tasks = buildTaskList(TMP)
  const engineerTasks = tasks.filter(t => t.to === 'engineer' && t.status === 'pending')
  assert.equal(engineerTasks[0].priority, 'high')  // high before medium
  assert.equal(engineerTasks[1].priority, 'medium')
})

test('getNextId bootstraps from existing task files when no counter file', (t) => {
  const dir = join(tmpdir(), `tasks-${Date.now()}`)
  mkdirSync(dir)
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  // Write a task file with id 003
  writeFileSync(join(dir, '003-some-task.md'), `---\nid: "003"\ntitle: "Task"\nstatus: pending\n---\n`)

  const id = getNextId(dir)
  assert.equal(id, '004')
})

test('getNextId uses counter file when present', (t) => {
  const dir = join(tmpdir(), `tasks-${Date.now()}`)
  mkdirSync(dir)
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, '.next-id'), '7')
  const id = getNextId(dir)
  assert.equal(id, '007')
})

test('getNextId increments counter file after call', (t) => {
  const dir = join(tmpdir(), `tasks-${Date.now()}`)
  mkdirSync(dir)
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, '.next-id'), '5')
  getNextId(dir)  // consume 005
  const id2 = getNextId(dir)  // should be 006
  assert.equal(id2, '006')
})

test('getNextId returns 001 when tasks dir is empty and no counter', (t) => {
  const dir = join(tmpdir(), `tasks-${Date.now()}`)
  mkdirSync(dir)
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  const id = getNextId(dir)
  assert.equal(id, '001')
})

test('getNextId returns 001 when counter file contains non-numeric value', (t) => {
  const dir = join(tmpdir(), `tasks-${Date.now()}`)
  mkdirSync(dir)
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, '.next-id'), 'notanumber')
  const id = getNextId(dir)
  assert.equal(id, '001')
})

test('parseFrontmatter handles CRLF line endings', () => {
  const content = '---\r\nid: "001"\r\ntitle: "Test"\r\nstatus: pending\r\n---\r\n\r\nBody'
  const result = parseFrontmatter(content)
  assert.equal(result.id, '001')
  assert.equal(result.title, 'Test')
  assert.equal(result.status, 'pending')
})
