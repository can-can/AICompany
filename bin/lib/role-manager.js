import { EventEmitter } from 'node:events'
import { priorityOrder } from './task-parser.js'

export function createRoleManager(roles, sdkRunner, readTaskFile, logger) {
  const runners = {}
  const emitter = new EventEmitter()

  for (const role of roles) {
    runners[role] = {
      state: 'free',
      queue: [],
      sdkInFlight: false,
      currentTask: null,
      sessionId: null,
      dispatchChain: Promise.resolve(),
      _idleResolvers: [],
      lastMessages: [],   // last assistant messages from SDK (shown on dashboard)
      inputQueue: [],      // human messages queued while agent is busy
    }
  }

  function getRunner(role) {
    if (!runners[role]) throw new Error(`Unknown role: ${role}`)
    return runners[role]
  }

  function setSessionId(role, id) {
    if (id && id !== runners[role].sessionId) {
      runners[role].sessionId = id
    }
  }

  function scheduleDispatch(role) {
    const runner = getRunner(role)
    runner.dispatchChain = runner.dispatchChain.then(() => tryDispatch(role)).catch(err => {
      logger.add('error', role, `dispatch error: ${err.message}`)
    })
  }

  async function tryDispatch(role) {
    const runner = getRunner(role)
    if (runner.sdkInFlight) return

    if (runner.currentTask) {
      const fresh = readTaskFile(runner.currentTask.filepath)
      if (!fresh) {
        logger.add('warn', role, `task #${runner.currentTask.id} file gone — treating as done`)
      } else if (fresh.status === 'in_progress') {
        // Check if human sent input while we were running
        const humanMsg = runner.inputQueue.shift()
        if (humanMsg) {
          logger.add('info', role, `delivering human input to task #${runner.currentTask.id}`)
          runner.state = 'working'
          runner.sdkInFlight = true
          try {
            const result = await sdkRunner(fresh, role, runner.sessionId, {
              prompt: humanMsg,
              onMessage: (msg) => emitter.emit('message', { role, ...msg })
            })
            setSessionId(role, result?.sessionId)
            if (result?.messages?.length) {
              runner.lastMessages = result.messages
            }
          } catch (err) {
            logger.add('error', role, `sdk error on task #${fresh.id}: ${err.message}`)
          } finally {
            runner.sdkInFlight = false
            runner.state = 'ready'
            runner.currentTask = readTaskFile(fresh.filepath) ?? { ...fresh, status: 'done' }
            scheduleDispatch(role)
          }
          return
        }
        runner.state = 'waiting_human'
        logger.add('warn', role, `waiting for human input on task #${runner.currentTask.id}`)
        notifyIdle(role)
        return
      }
    }

    const next = runner.queue.shift()
    if (!next) {
      runner.state = 'free'
      runner.currentTask = null
      notifyIdle(role)
      return
    }

    runner.state = 'working'
    runner.sdkInFlight = true
    runner.currentTask = next
    logger.add('info', role, `dispatching task #${next.id}: ${next.title}`)

    try {
      const result = await sdkRunner(next, role, runner.sessionId, {
        onMessage: (msg) => emitter.emit('message', { role, ...msg })
      })
      setSessionId(role, result?.sessionId)
      if (result?.messages?.length) {
        runner.lastMessages = result.messages
      }
    } catch (err) {
      logger.add('error', role, `sdk error on task #${next.id}: ${err.message}`)
    } finally {
      runner.sdkInFlight = false
      runner.state = 'ready'                 // transient ready state visible to dashboard
      runner.currentTask = readTaskFile(next.filepath) ?? { ...next, status: 'done' }
      scheduleDispatch(role)
    }
  }

  function notifyIdle(role) {
    const runner = runners[role]
    for (const resolve of runner._idleResolvers) resolve()
    runner._idleResolvers = []
  }

  function enqueue(task) {
    const role = task.to
    if (!runners[role]) {
      logger.add('warn', null, `enqueue: unknown role "${role}" for task #${task.id ?? '?'}`)
      return
    }
    if (task.status !== 'pending') return
    // Deduplicate: skip if already queued
    if (runners[role].queue.some(t => t.id === task.id)) return
    runners[role].queue.push(task)
    runners[role].queue.sort((a, b) => {
      const pd = priorityOrder(a.priority) - priorityOrder(b.priority)
      return pd !== 0 ? pd : a.created.localeCompare(b.created)
    })
    scheduleDispatch(role)
  }

  function sendInput(role, message) {
    const runner = getRunner(role)
    runner.inputQueue.push(message)
    emitter.emit('message', { role, type: 'user', text: message })
    if (runner.state === 'waiting_human') {
      // Kick dispatch to pick up the queued input
      scheduleDispatch(role)
    }
  }

  function getState(role) {
    return getRunner(role).state
  }

  function getStatus() {
    const result = {}
    for (const [role, runner] of Object.entries(runners)) {
      result[role] = {
        state: runner.state,
        activeTask: runner.currentTask ? { id: runner.currentTask.id, title: runner.currentTask.title } : null,
        queueDepth: runner.queue.length,
        lastMessages: runner.lastMessages,
      }
    }
    return result
  }

  // waitIdle resolves once the role reaches 'free' or 'waiting_human'.
  // It must handle the race where state is still 'free' but dispatch is queued on
  // the microtask queue. Strategy: repeatedly await dispatchChain until it stabilises,
  // then check state; if still active, block on an _idleResolver notification.
  async function waitIdle(role) {
    const runner = getRunner(role)

    // Drain the dispatchChain until it stops advancing, then check state.
    // Each scheduleDispatch() call appends to the chain, so we keep re-awaiting
    // until the reference stops changing between iterations.
    let prev = null
    while (runner.dispatchChain !== prev) {
      prev = runner.dispatchChain
      await runner.dispatchChain
    }

    // After chain is stable, if we're idle we're done.
    if (runner.state === 'free' || runner.state === 'waiting_human') return

    // Otherwise (sdkInFlight in a chained dispatch), wait for explicit notification.
    await new Promise(resolve => runner._idleResolvers.push(resolve))

    // After notification, drain once more in case another task was queued.
    return waitIdle(role)
  }

  function loadSessions(sessions) {
    for (const [role, id] of Object.entries(sessions)) {
      if (runners[role]) runners[role].sessionId = id
    }
  }

  function getSessions() {
    const result = {}
    for (const [role, runner] of Object.entries(runners)) {
      if (runner.sessionId) result[role] = runner.sessionId
    }
    return result
  }

  function restoreInProgressTasks(tasks) {
    for (const task of tasks) {
      if (task.status !== 'in_progress' || !task.to) continue
      const runner = runners[task.to]
      if (!runner) continue
      if (runner.currentTask) continue
      runner.currentTask = task
      runner.state = 'waiting_human'
      logger.add('info', task.to, `restored waiting_human for task #${task.id}: ${task.title}`)
    }
  }

  async function initializeSessions() {
    const promises = []
    for (const [role, runner] of Object.entries(runners)) {
      if (!runner.sessionId) {
        promises.push(
          (async () => {
            logger.add('info', role, 'initializing session...')
            try {
              const result = await sdkRunner(null, role, null, {
                prompt: `You are the ${role}. Session initialized. Await tasks.`
              })
              if (result?.sessionId) {
                runner.sessionId = result.sessionId
                logger.add('info', role, 'session initialized')
              }
            } catch (err) {
              logger.add('error', role, `session init failed: ${err.message}`)
            }
          })()
        )
      }
    }
    await Promise.all(promises)
  }

  return { enqueue, getState, getStatus, scheduleDispatch, sendInput, loadSessions, getSessions, initializeSessions, restoreInProgressTasks, waitIdle, emitter }
}
