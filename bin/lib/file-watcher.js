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

  function handleTaskFile(filepath) {
    const name = basename(filepath)
    if (!name.endsWith('.md') || name.startsWith('.')) return
    const task = readTaskFile(filepath)
    if (!task) return

    logger.add('info', task.to, `file event: ${task.id} status=${task.status}`)

    if (task.status === 'pending') {
      roleManager.enqueue(task)
    } else if (task.status === 'done' || task.status === 'rejected') {
      // Unblock the to-role if it is in waiting_human (human resolved the task by editing the file)
      if (task.to) roleManager.scheduleDispatch(task.to)
      // Notify the from-role so it can pick up its next pending task
      if (task.from && task.from !== 'human') roleManager.scheduleDispatch(task.from)
    }
  }

  watcher.on('add', handleTaskFile)
  watcher.on('change', handleTaskFile)
  watcher.on('error', err => logger.add('error', null, `watcher error: ${err.message}`))

  return {
    close: () => watcher.close()
  }
}
