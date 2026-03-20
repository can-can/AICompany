import { describe, it, expect, vi, beforeEach } from 'vitest'
import { convertMessage } from '../src/lib/useAICompanyRuntime'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('convertMessage', () => {
  it('maps assistant entry to assistant role', () => {
    const result = convertMessage({ role: 'assistant', id: 'uuid-1', text: 'Hello' }, 0)
    expect(result.role).toBe('assistant')
    expect(result.content).toEqual([{ type: 'text', text: 'Hello' }])
    expect(result.id).toBe('uuid-1')
  })

  it('maps user entry to user role', () => {
    const result = convertMessage({ role: 'user', id: 'uuid-2', text: 'Hi' }, 1)
    expect(result.role).toBe('user')
    expect(result.content).toEqual([{ type: 'text', text: 'Hi' }])
    expect(result.id).toBe('uuid-2')
  })

  it('handles empty messages array', () => {
    const messages: { role: 'user' | 'assistant'; id: string; text: string }[] = []
    const converted = messages.map(convertMessage)
    expect(converted).toEqual([])
  })
})
