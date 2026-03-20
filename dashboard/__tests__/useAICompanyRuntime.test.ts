import { describe, it, expect, vi, beforeEach } from 'vitest'
import { convertMessage } from '../src/lib/useAICompanyRuntime'
import * as api from '../src/lib/api'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('convertMessage', () => {
  it('maps agent entry to assistant role', () => {
    const result = convertMessage({ from: 'agent', text: 'Hello', timestamp: 1000 }, 0)
    expect(result.role).toBe('assistant')
    expect(result.content).toEqual([{ type: 'text', text: 'Hello' }])
    expect(result.id).toBe('msg-0')
    expect(result.createdAt).toEqual(new Date(1000))
  })

  it('maps human entry to user role', () => {
    const result = convertMessage({ from: 'human', text: 'Hi', timestamp: 2000 }, 1)
    expect(result.role).toBe('user')
    expect(result.content).toEqual([{ type: 'text', text: 'Hi' }])
    expect(result.id).toBe('msg-1')
  })
})

describe('runtime polling and sending', () => {
  it('fetchStatus returns conversation history for runtime consumption', async () => {
    vi.spyOn(api, 'fetchStatus').mockResolvedValue({
      project: 'myapp',
      roles: {
        pm: {
          state: 'waiting_human',
          activeTask: { id: '001', title: 'Test' },
          queueDepth: 0,
          lastMessages: [],
          conversationHistory: [
            { from: 'agent', text: 'What should I do?', timestamp: 1000 },
            { from: 'human', text: 'Build it', timestamp: 2000 },
          ],
        },
      },
    })

    const result = await api.fetchStatus('myapp')
    expect(result!.roles.pm.conversationHistory).toHaveLength(2)

    // Verify convertMessage works on actual history data
    const messages = result!.roles.pm.conversationHistory.map(convertMessage)
    expect(messages[0].role).toBe('assistant')
    expect(messages[1].role).toBe('user')
  })

  it('sendMessage posts to API then re-poll fetches updated state', async () => {
    const sendSpy = vi.spyOn(api, 'sendMessage').mockResolvedValue({ ok: true })
    const statusSpy = vi.spyOn(api, 'fetchStatus').mockResolvedValue({
      project: 'myapp',
      roles: { pm: { state: 'working', activeTask: null, queueDepth: 0, lastMessages: [], conversationHistory: [] } },
    })

    await api.sendMessage('myapp', 'pm', 'do it')
    await api.fetchStatus('myapp')

    expect(sendSpy).toHaveBeenCalledWith('myapp', 'pm', 'do it')
    expect(statusSpy).toHaveBeenCalledWith('myapp')
  })

  it('handles empty conversation history gracefully', () => {
    const messages: { from: 'agent' | 'human'; text: string; timestamp: number }[] = []
    const converted = messages.map(convertMessage)
    expect(converted).toEqual([])
  })
})
