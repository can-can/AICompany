import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildPrompt } from '../bin/lib/sdk-runner.js'

test('buildPrompt includes company.md, CLAUDE.md, and task content', (t) => {
  const dir = join(tmpdir(), `sdk-test-${Date.now()}-a`)
  mkdirSync(join(dir, 'roles', 'engineer'), { recursive: true })
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, 'company.md'), '# Test Company')
  writeFileSync(join(dir, 'roles', 'engineer', 'CLAUDE.md'), '# Engineer Role')
  const taskPath = join(dir, 'tasks', '001-test.md')
  mkdirSync(join(dir, 'tasks'), { recursive: true })
  writeFileSync(taskPath, '---\nid: "001"\ntitle: "Build it"\nstatus: pending\n---\nBuild the thing')

  const prompt = buildPrompt({ filepath: taskPath }, 'engineer', dir)

  assert.ok(prompt.includes('# Test Company'), 'should include company.md content')
  assert.ok(prompt.includes('# Engineer Role'), 'should include CLAUDE.md content')
  assert.ok(prompt.includes('Build the thing'), 'should include task content')
  assert.ok(prompt.includes('You are the engineer'), 'should include role instruction')
})

test('buildPrompt works when CLAUDE.md does not exist', (t) => {
  const dir = join(tmpdir(), `sdk-test-${Date.now()}-b`)
  mkdirSync(join(dir, 'roles', 'qa'), { recursive: true })
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, 'company.md'), '# Company')
  const taskPath = join(dir, 'tasks', '002-test.md')
  mkdirSync(join(dir, 'tasks'), { recursive: true })
  writeFileSync(taskPath, '---\nid: "002"\ntitle: "Test"\nstatus: pending\n---\nTest it')

  const prompt = buildPrompt({ filepath: taskPath }, 'qa', dir)

  assert.ok(prompt.includes('Test it'), 'should include task content')
  assert.ok(prompt.includes('You are the qa'), 'should include role instruction')
  // CLAUDE.md is missing — prompt should still work (empty string for role section)
  assert.ok(prompt.includes('# Your Role'), 'should have role section header')
})
