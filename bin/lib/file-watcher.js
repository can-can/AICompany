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

  let initialScanComplete = false
  const processedDone = new Set()

  function handleTaskFile(filepath) {
    const name = basename(filepath)
    if (!name.endsWith('.md') || name.startsWith('.')) return
    const task = readTaskFile(filepath)
    if (!task) return

    if (task.status === 'pending') {
      logger.add('info', task.to, `file event: ${task.id} status=${task.status}`)
      roleManager.enqueue(task)
    } else if (task.status === 'done' || task.status === 'rejected') {
      // During initial scan, skip done/rejected tasks — they're historical
      if (!initialScanComplete) return
      // Skip if we already dispatched for this done task (prevents floods on re-touch)
      if (processedDone.has(task.id)) return
      processedDone.add(task.id)

      logger.add('info', task.to, `file event: ${task.id} status=${task.status}`)
      // Unblock the to-role if it is in waiting_human (human resolved the task by editing the file)
      if (task.to) roleManager.scheduleDispatch(task.to)
      // Notify the from-role so it can pick up its next pending task
      if (task.from && task.from !== 'human') roleManager.scheduleDispatch(task.from)
    }
  }

  watcher.on('add', handleTaskFile)
  watcher.on('change', handleTaskFile)
  watcher.on('ready', () => { initialScanComplete = true })
  watcher.on('error', err => logger.add('error', null, `watcher error: ${err.message}`))

  return {
    close: () => watcher.close()
  }
}
