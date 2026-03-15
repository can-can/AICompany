import { readFileSync, readdirSync, existsSync, writeFileSync, openSync, closeSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const PRIORITY_MAP = { high: 0, medium: 1, low: 2 }

export function priorityOrder(priority) {
  return PRIORITY_MAP[priority] ?? 3
}

export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const result = {}
  for (const line of match[1].split(/\r?\n/)) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
    result[key] = value === 'null' ? null : value
  }
  return result
}

export function readTaskFile(filepath) {
  try {
    const content = readFileSync(filepath, 'utf8')
    const fields = parseFrontmatter(content)
    if (!fields || !fields.id) return null
    return {
      id: fields.id,
      title: fields.title ?? '',
      status: fields.status ?? 'pending',
      from: fields.from ?? null,
      to: fields.to ?? null,
      owner: fields.owner ?? null,
      priority: fields.priority ?? 'medium',
      created: fields.created ?? '',
      updated: fields.updated ?? '',
      filepath
    }
  } catch {
    return null
  }
}

export function buildTaskList(tasksDir) {
  let files
  try {
    files = readdirSync(tasksDir).filter(f => f.endsWith('.md') && !f.startsWith('.'))
  } catch {
    return []
  }
  const tasks = files
    .map(f => readTaskFile(join(tasksDir, f)))
    .filter(Boolean)
  tasks.sort((a, b) => {
    const pd = priorityOrder(a.priority) - priorityOrder(b.priority)
    if (pd !== 0) return pd
    return a.created.localeCompare(b.created)
  })
  return tasks
}

export function getNextId(tasksDir) {
  const counterFile = join(tasksDir, '.next-id')
  const lockFile = join(tasksDir, '.next-id.lock')

  let lockFd
  for (let i = 0; i < 50; i++) {
    try {
      lockFd = openSync(lockFile, 'wx')
      break
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
    }
  }
  if (lockFd === undefined) throw new Error('Failed to acquire task ID lock')

  try {
    let next

    if (existsSync(counterFile)) {
      next = parseInt(readFileSync(counterFile, 'utf8').trim(), 10)
      if (isNaN(next)) next = 1
    } else {
      // Bootstrap: scan existing task files for highest numeric id
      let max = 0
      try {
        const files = readdirSync(tasksDir).filter(f => f.endsWith('.md') && !f.startsWith('.'))
        for (const f of files) {
          const task = readTaskFile(join(tasksDir, f))
          if (!task?.id) continue
          const n = parseInt(task.id, 10)
          if (!isNaN(n) && n > max) max = n
        }
      } catch {}
      next = max + 1
    }

    writeFileSync(counterFile, String(next + 1))
    return String(next).padStart(3, '0')
  } finally {
    closeSync(lockFd)
    try { unlinkSync(lockFile) } catch {}
  }
}
