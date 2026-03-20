import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchProjects, fetchStatus, fetchTasks, fetchLogs, sendMessage } from '../src/lib/api'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('fetchProjects', () => {
  it('returns parsed project list', async () => {
    const data = [{ name: 'myapp', path: '/tmp/myapp', status: 'active' }]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(data), { status: 200 })
    )
    const result = await fetchProjects()
    expect(result).toEqual(data)
    expect(fetch).toHaveBeenCalledWith('/api/projects')
  })
})

describe('fetchStatus', () => {
  it('returns role status data', async () => {
    const data = { project: 'myapp', roles: { pm: { state: 'free' } } }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(data), { status: 200 })
    )
    const result = await fetchStatus('myapp')
    expect(result).toEqual(data)
    expect(fetch).toHaveBeenCalledWith('/api/status?project=myapp')
  })

  it('returns null for offline projects (503)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'offline' }), { status: 503 })
    )
    const result = await fetchStatus('myapp')
    expect(result).toBeNull()
  })
})

describe('fetchTasks', () => {
  it('returns parsed task list', async () => {
    const data = [{ id: '001', title: 'Test', from: 'human', to: 'pm', owner: 'pm', status: 'pending', priority: 'high' }]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(data), { status: 200 })
    )
    const result = await fetchTasks('myapp')
    expect(result).toEqual(data)
    expect(fetch).toHaveBeenCalledWith('/api/tasks?project=myapp')
  })

  it('returns empty array on error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 503 })
    )
    const result = await fetchTasks('myapp')
    expect(result).toEqual([])
  })
})

describe('fetchLogs', () => {
  it('returns parsed log entries', async () => {
    const data = [{ timestamp: '2026-03-19T10:00:00Z', level: 'info', role: 'pm', message: 'started' }]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(data), { status: 200 })
    )
    const result = await fetchLogs('myapp')
    expect(result).toEqual(data)
    expect(fetch).toHaveBeenCalledWith('/api/logs?project=myapp&limit=50')
  })
})

describe('sendMessage', () => {
  it('posts correctly and returns ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    )
    const result = await sendMessage('myapp', 'pm', 'hello')
    expect(result).toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledWith('/api/send?project=myapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'pm', message: 'hello' }),
    })
  })

  it('throws on error responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'bad request' }), { status: 400 })
    )
    await expect(sendMessage('myapp', 'pm', '')).rejects.toThrow('bad request')
  })
})
