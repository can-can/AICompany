import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLogger } from '../bin/lib/logger.js'

test('addLog stores entries and getLogs returns them in order', () => {
  const log = createLogger()
  log.add('info', null, 'server started')
  log.add('warn', 'engineer', 'task delayed')
  const entries = log.get(10)
  assert.equal(entries.length, 2)
  assert.equal(entries[0].message, 'server started')
  assert.equal(entries[0].level, 'info')
  assert.equal(entries[0].role, null)
  assert.equal(entries[1].role, 'engineer')
  assert.ok(entries[0].timestamp)
})

test('getLogs returns at most n entries', () => {
  const log = createLogger()
  for (let i = 0; i < 10; i++) log.add('info', null, `msg ${i}`)
  assert.equal(log.get(3).length, 3)
})

test('ring buffer evicts oldest entries when capacity exceeded', () => {
  const log = createLogger(5)  // capacity 5
  for (let i = 0; i < 7; i++) log.add('info', null, `msg ${i}`)
  const entries = log.get(10)
  assert.equal(entries.length, 5)
  assert.equal(entries[0].message, 'msg 2')  // oldest 2 evicted
  assert.equal(entries[4].message, 'msg 6')
})

test('getLogs returns most recent entries last', () => {
  const log = createLogger()
  log.add('info', null, 'first')
  log.add('info', null, 'last')
  const entries = log.get(2)
  assert.equal(entries[entries.length - 1].message, 'last')
})
