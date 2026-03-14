import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { readTaskFile, buildTaskList, priorityOrder } from '../bin/lib/task-parser.js'

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
