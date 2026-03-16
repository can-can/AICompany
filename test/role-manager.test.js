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
  async function runAgent(task, role, sessionId, opts) {
    calls.push({ task, role, sessionId, prompt: opts?.prompt })
    return { sessionId: sessionId ?? `sess-${role}`, resultStatus, messages: ['agent reply'] }
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

test('getStatus returns state, activeTask, queueDepth, and lastMessages for all roles', () => {
  const mgr = createRoleManager(['engineer', 'pm'], makeMockSdk(), makeMockReadTask(), createLogger())
  const status = mgr.getStatus()
  assert.ok(status.engineer)
  assert.ok(status.pm)
  assert.equal(status.engineer.state, 'free')
  assert.equal(status.engineer.queueDepth, 0)
  assert.equal(status.engineer.activeTask, null)
  assert.deepEqual(status.engineer.lastMessages, [])
})

test('sendInput delivers message to waiting_human agent and resumes', async () => {
  let sdkCalls = 0
  let readCalls = 0
  const sdk = async (task, role, sessionId, opts) => {
    sdkCalls++
    return { sessionId: 'sess', resultStatus: 'done', messages: [`reply ${sdkCalls}`] }
  }
  // Flow: enqueue → tryDispatch → sdk#1 → finally.readTask(call1=in_progress) → scheduleDispatch
  //   → tryDispatch → readTask(call2=in_progress) → waiting_human
  // sendInput → scheduleDispatch → tryDispatch → readTask(call3=in_progress) → inputQueue has msg
  //   → sdk#2 → finally.readTask(call4=done) → scheduleDispatch → tryDispatch → queue empty → free
  const readTask = (filepath) => {
    readCalls++
    // Return done only on 4th+ read (after second SDK call completes)
    const status = readCalls >= 4 ? 'done' : 'in_progress'
    return makeTask({ status, filepath })
  }
  const mgr = createRoleManager(['engineer'], sdk, readTask, createLogger())
  mgr.enqueue(makeTask({ to: 'engineer' }))
  await mgr.waitIdle('engineer')
  assert.equal(mgr.getState('engineer'), 'waiting_human')
  assert.equal(sdkCalls, 1)

  mgr.sendInput('engineer', 'please continue')
  await mgr.waitIdle('engineer')
  assert.equal(sdkCalls, 2)
  assert.equal(mgr.getState('engineer'), 'free')
})

test('sendInput queues message when agent is busy', async () => {
  let resolve
  let callCount = 0
  const sdk = async (task, role, sessionId, opts) => {
    callCount++
    if (callCount === 1) {
      await new Promise(r => { resolve = r })
    }
    return { sessionId: 'sess', resultStatus: 'done', messages: ['reply'] }
  }
  const mgr = createRoleManager(['engineer'], sdk, makeMockReadTask('done'), createLogger())
  mgr.enqueue(makeTask({ to: 'engineer' }))
  await new Promise(r => setTimeout(r, 10))
  assert.equal(mgr.getState('engineer'), 'working')

  // Send input while agent is busy — should queue
  mgr.sendInput('engineer', 'hurry up')
  assert.equal(mgr.getState('engineer'), 'working')

  resolve() // let the first call finish
  await mgr.waitIdle('engineer')
  // Input was queued but agent finished task (done status) — queue is drained on next dispatch
  assert.equal(mgr.getState('engineer'), 'free')
})

test('lastMessages captured from SDK result', async () => {
  const sdk = makeMockSdk('done')
  const mgr = createRoleManager(['engineer'], sdk, makeMockReadTask('done'), createLogger())
  mgr.enqueue(makeTask({ to: 'engineer' }))
  await mgr.waitIdle('engineer')
  const status = mgr.getStatus()
  assert.deepEqual(status.engineer.lastMessages, ['agent reply'])
})
