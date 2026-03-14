import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Override home dir for tests via env var
let tmpHome
beforeEach(() => {
  tmpHome = join(tmpdir(), `ac-test-${process.pid}-${Date.now()}`)
  mkdirSync(tmpHome, { recursive: true })
  process.env.AI_COMPANY_HOME = tmpHome
})
afterEach(() => {
  rmSync(tmpHome, { recursive: true, force: true })
  delete process.env.AI_COMPANY_HOME
})

// No cache-busting needed: project-registry exports FUNCTIONS for paths,
// so setting process.env.AI_COMPANY_HOME before calling them is sufficient.
import { readRegistry, addProject, removeProject, resolveProject } from '../bin/lib/project-registry.js'

test('readRegistry returns [] when no file exists', () => {
  assert.deepEqual(readRegistry(), [])
})

test('addProject writes entry to registry', () => {
  addProject('MyApp', '/tmp/myapp')
  const projects = readRegistry()
  assert.equal(projects.length, 1)
  assert.equal(projects[0].name, 'MyApp')
})

test('addProject deduplicates by name', () => {
  addProject('MyApp', '/tmp/myapp')
  addProject('MyApp', '/tmp/myapp2')
  assert.equal(readRegistry().length, 1)
  assert.equal(readRegistry()[0].path, '/tmp/myapp2')
})

test('addProject deduplicates by path', () => {
  addProject('MyApp', '/tmp/myapp')
  addProject('MyApp2', '/tmp/myapp')
  assert.equal(readRegistry().length, 1)
})

test('removeProject removes by name', () => {
  addProject('MyApp', '/tmp/myapp')
  removeProject('MyApp')
  assert.equal(readRegistry().length, 0)
})

test('resolveProject finds project when cwd matches path', () => {
  addProject('MyApp', '/tmp/myapp')
  const found = resolveProject('/tmp/myapp')
  assert.equal(found?.name, 'MyApp')
})

test('resolveProject finds project when cwd is subdirectory', () => {
  addProject('MyApp', '/tmp/myapp')
  const found = resolveProject('/tmp/myapp/src/components')
  assert.equal(found?.name, 'MyApp')
})

test('resolveProject returns null when not inside any project', () => {
  addProject('MyApp', '/tmp/myapp')
  assert.equal(resolveProject('/tmp/other'), null)
})

test('removeProject removes by path', () => {
  addProject('MyApp', '/tmp/myapp')
  removeProject('/tmp/myapp')
  assert.equal(readRegistry().length, 0)
})
