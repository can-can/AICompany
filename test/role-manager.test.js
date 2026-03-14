import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRoleManager } from '../bin/lib/role-manager.js'
import { createLogger } from '../bin/lib/logger.js'

function makeTask(overrides = {}) {
  return {
    id: '001', title: 'Test task', status: 'pending',
    from: 'human', to: 'engineer', priority: 'high',
    created: '2026-03-13', filepath: '/tmp/tasks/001-test.md',
    ...overrides
  }
}

function makeMockSdk(resultStatus = 'done') {
  const calls = []
  async function runAgent(task, role, sessionId) {
    calls.push({ task, role, sessionId })
    // Simulate agent updating the task file status
    return { sessionId: sessionId ?? `sess-${role}`, resultStatus }
  }
  runAgent.calls = calls
  return runAgent
}

function makeMockReadTask(status = 'done') {
  return (filepath) => ({ ...makeTask({ status, filepath }) })
}

test('initial state is free', () => {
  const mgr = createRoleManager(['engineer'], makeMockSdk(), makeMockReadTask(), createLogger())
  assert.equal(mgr.getState('engineer'), 'free')
})

test('enqueuing a pending task changes state to working', async () => {
  const sdk = makeMockSdk('done')
  const mgr = createRoleManager(['engineer'], sdk, makeMockReadTask('done'), createLogger())
  mgr.enqueue(makeTask({ to: 'engineer', status: 'pending' }))
  await mgr.waitIdle('engineer')
  assert.equal(mgr.getState('engineer'), 'free')
  assert.equal(sdk.calls.length, 1)
})

test('role stays working while sdk is in flight', async () => {
  let resolve
  const sdk = async () => {
    await new Promise(r => { resolve = r })
    return { sessionId: 'sess', resultStatus: 'done' }
  }
  const mgr = createRoleManager(['engineer'], sdk, makeMockReadTask('done'), createLogger())
  mgr.enqueue(makeTask({ to: 'engineer' }))
  await new Promise(r => setTimeout(r, 10))
  assert.equal(mgr.getState('engineer'), 'working')
  resolve()
})

test('state becomes waiting_human when sdk returns but task still in_progress', async () => {
  const sdk = makeMockSdk('done')
  const readTask = makeMockReadTask('in_progress')  // task file still in_progress after sdk returns
  const mgr = createRoleManager(['engineer'], sdk, readTask, createLogger())
  mgr.enqueue(makeTask({ to: 'engineer' }))
  await mgr.waitIdle('engineer')
  assert.equal(mgr.getState('engineer'), 'waiting_human')
})

test('second task queued while first is in flight — dispatched after first completes', async () => {
  const sdk = makeMockSdk('done')
  const mgr = createRoleManager(['engineer'], sdk, makeMockReadTask('done'), createLogger())
  mgr.enqueue(makeTask({ id: '001', to: 'engineer' }))
  mgr.enqueue(makeTask({ id: '002', to: 'engineer' }))
  await mgr.waitIdle('engineer')
  assert.equal(sdk.calls.length, 2)
})

test('getStatus returns state, activeTask, and queueDepth for all roles', () => {
  const mgr = createRoleManager(['engineer', 'pm'], makeMockSdk(), makeMockReadTask(), createLogger())
  const status = mgr.getStatus()
  assert.ok(status.engineer)
  assert.ok(status.pm)
  assert.equal(status.engineer.state, 'free')
  assert.equal(status.engineer.queueDepth, 0)
  assert.equal(status.engineer.activeTask, null)
})
