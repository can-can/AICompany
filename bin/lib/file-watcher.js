import chokidar from 'chokidar'
import { basename } from 'node:path'
import { readTaskFile } from './task-parser.js'

export function createFileWatcher(tasksDir, roleManager, logger) {
  // Watch the directory, not a glob — chokidar 4 does not fire initial 'add'
  // events for existing files when given a glob pattern, but does when given a directory.
  const watcher = chokidar.watch(tasksDir, {
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
  })

  // Track known task statuses to detect actual transitions.
  // 'add' events populate the map without dispatching (could be initial scan or new file).
  // 'change' events dispatch only when status actually transitions to done/rejected.
  const knownStatus = new Map()

  function handleAdd(filepath) {
    const name = basename(filepath)
    if (!name.endsWith('.md') || name.startsWith('.')) return
    const task = readTaskFile(filepath)
    if (!task) return

    // Record current status — don't dispatch for done tasks on 'add' since we
    // can't distinguish initial scan from new files, and a new file arriving
    // already-done is not a transition we need to react to.
    knownStatus.set(task.id, task.status)

    if (task.status === 'pending') {
      logger.add('info', task.to, `file event: ${task.id} status=${task.status}`)
      roleManager.enqueue(task)
    }
  }

  function handleChange(filepath) {
    const name = basename(filepath)
    if (!name.endsWith('.md') || name.startsWith('.')) return
    const task = readTaskFile(filepath)
    if (!task) return

    const prevStatus = knownStatus.get(task.id)
    knownStatus.set(task.id, task.status)

    if (task.status === 'pending') {
      logger.add('info', task.to, `file event: ${task.id} status=${task.status}`)
      roleManager.enqueue(task)
    } else if (task.status === 'done' || task.status === 'rejected') {
      // Only dispatch if status actually changed (not a no-op re-write)
      if (prevStatus === task.status) return

      logger.add('info', task.to, `file event: ${task.id} status=${task.status}`)
      if (task.to) roleManager.scheduleDispatch(task.to)
      if (task.from && task.from !== 'human') roleManager.notifyTaskDone(task.from, task)
    }
  }

  watcher.on('add', handleAdd)
  watcher.on('change', handleChange)
  watcher.on('error', err => logger.add('error', null, `watcher error: ${err.message}`))

  return {
    close: () => watcher.close()
  }
}
