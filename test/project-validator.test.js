import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { validateProject } from '../bin/lib/project-validator.js'

// packageRoot is the ai-company package root (has templates/, roles/*.md, memories/*.md)
const packageRoot = join(import.meta.dirname, '..')

function makeTmpDir(suffix) {
  const dir = join(tmpdir(), `validate-test-${Date.now()}-${suffix}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

test('valid project returns no errors', (t) => {
  const dir = makeTmpDir('valid')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, 'company.md'), '# Company')
  mkdirSync(join(dir, 'roles', 'engineer'), { recursive: true })
  writeFileSync(join(dir, 'roles', 'engineer', 'CLAUDE.md'), '# Engineer')
  writeFileSync(join(dir, 'roles', 'engineer', 'memory.md'), '# Memory')
  mkdirSync(join(dir, 'tasks'), { recursive: true })

  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, true)
  assert.equal(result.errors.length, 0)
  assert.equal(result.fixes.length, 0)
})

test('missing company.md is fixable', (t) => {
  const dir = makeTmpDir('no-company')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  mkdirSync(join(dir, 'roles', 'pm'), { recursive: true })
  writeFileSync(join(dir, 'roles', 'pm', 'CLAUDE.md'), '# PM')
  writeFileSync(join(dir, 'roles', 'pm', 'memory.md'), '# Mem')
  mkdirSync(join(dir, 'tasks'))

  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.includes('company.md')))
  assert.ok(result.fixes.some(f => f.description.includes('company.md')))

  result.fixes.forEach(f => f.apply())
  assert.ok(existsSync(join(dir, 'company.md')))
})

test('missing roles/ directory is fixable', (t) => {
  const dir = makeTmpDir('no-roles')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, 'company.md'), '# Company')
  mkdirSync(join(dir, 'tasks'))

  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.includes('roles/')))
  assert.ok(result.fixes.some(f => f.description.includes('roles/')))
})

test('empty roles/ directory is fixable with default roles', (t) => {
  const dir = makeTmpDir('empty-roles')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, 'company.md'), '# Company')
  mkdirSync(join(dir, 'roles'))
  mkdirSync(join(dir, 'tasks'))

  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.includes('No role directories')))
  assert.ok(result.fixes.some(f => f.description.includes('No role directories')))

  result.fixes.forEach(f => f.apply())
  for (const role of ['pm', 'engineer', 'qa']) {
    assert.ok(existsSync(join(dir, 'roles', role, 'CLAUDE.md')), `${role}/CLAUDE.md should exist`)
    assert.ok(existsSync(join(dir, 'roles', role, 'memory.md')), `${role}/memory.md should exist`)
  }
})

test('role missing CLAUDE.md is fixable with template', (t) => {
  const dir = makeTmpDir('no-claudemd')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, 'company.md'), '# Company')
  mkdirSync(join(dir, 'roles', 'engineer'), { recursive: true })
  writeFileSync(join(dir, 'roles', 'engineer', 'memory.md'), '# Mem')
  mkdirSync(join(dir, 'tasks'))

  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.includes('engineer') && e.includes('CLAUDE.md')))

  result.fixes.forEach(f => f.apply())
  assert.ok(existsSync(join(dir, 'roles', 'engineer', 'CLAUDE.md')))
})

test('role missing memory.md is fixable with template', (t) => {
  const dir = makeTmpDir('no-memorymd')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, 'company.md'), '# Company')
  mkdirSync(join(dir, 'roles', 'qa'), { recursive: true })
  writeFileSync(join(dir, 'roles', 'qa', 'CLAUDE.md'), '# QA')
  mkdirSync(join(dir, 'tasks'))

  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.includes('qa') && e.includes('memory.md')))

  result.fixes.forEach(f => f.apply())
  assert.ok(existsSync(join(dir, 'roles', 'qa', 'memory.md')))
})

test('missing tasks/ directory is fixable', (t) => {
  const dir = makeTmpDir('no-tasks')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, 'company.md'), '# Company')
  mkdirSync(join(dir, 'roles', 'pm'), { recursive: true })
  writeFileSync(join(dir, 'roles', 'pm', 'CLAUDE.md'), '# PM')
  writeFileSync(join(dir, 'roles', 'pm', 'memory.md'), '# Mem')

  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.includes('tasks/')))

  result.fixes.forEach(f => f.apply())
  assert.ok(existsSync(join(dir, 'tasks')))
})

test('multiple issues detected in single run', (t) => {
  const dir = makeTmpDir('multiple')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, false)
  assert.ok(result.errors.length >= 3)
})

test('custom role gets generic CLAUDE.md fallback', (t) => {
  const dir = makeTmpDir('custom-role')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, 'company.md'), '# Company')
  mkdirSync(join(dir, 'roles', 'analyst'), { recursive: true })
  writeFileSync(join(dir, 'roles', 'analyst', 'memory.md'), '# Mem')
  mkdirSync(join(dir, 'tasks'))

  const result = validateProject(dir, packageRoot)
  result.fixes.forEach(f => f.apply())

  const content = readFileSync(join(dir, 'roles', 'analyst', 'CLAUDE.md'), 'utf8')
  assert.ok(content.includes('analyst'))
})
