import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractMessages, createConversationReader } from '../bin/lib/conversation-reader.js'

test('extractMessages converts SDK SessionMessage array to chat entries', () => {
  const sdkMessages = [
    {
      type: 'user',
      uuid: 'uuid-1',
      session_id: 'sess-1',
      message: {
        role: 'user',
        content: [{ type: 'text', text: 'Hello agent' }]
      },
      parent_tool_use_id: null
    },
    {
      type: 'assistant',
      uuid: 'uuid-2',
      session_id: 'sess-1',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hi there!' },
          { type: 'tool_use', id: 'tu1', name: 'Read', input: {} },
          { type: 'text', text: ' How can I help?' }
        ]
      },
      parent_tool_use_id: null
    }
  ]

  const result = extractMessages(sdkMessages)
  assert.equal(result.length, 2)
  assert.deepEqual(result[0], { role: 'user', id: 'uuid-1', text: 'Hello agent' })
  assert.deepEqual(result[1], { role: 'assistant', id: 'uuid-2', text: 'Hi there! How can I help?' })
})

test('extractMessages skips messages with no text content', () => {
  const sdkMessages = [
    {
      type: 'assistant',
      uuid: 'uuid-3',
      session_id: 'sess-1',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tu2', name: 'Bash', input: {} }]
      },
      parent_tool_use_id: null
    }
  ]

  const result = extractMessages(sdkMessages)
  assert.equal(result.length, 0)
})

test('extractMessages handles string content (user messages)', () => {
  const sdkMessages = [
    {
      type: 'user',
      uuid: 'uuid-4',
      session_id: 'sess-1',
      message: { role: 'user', content: 'plain string message' },
      parent_tool_use_id: null
    }
  ]

  const result = extractMessages(sdkMessages)
  assert.equal(result.length, 1)
  assert.equal(result[0].text, 'plain string message')
})

test('readConversationPage returns last N messages with no cursor', async () => {
  const mockSdk = async () => [
    { type: 'user', uuid: 'u1', session_id: 's', message: { content: 'msg1' }, parent_tool_use_id: null },
    { type: 'assistant', uuid: 'u2', session_id: 's', message: { content: [{ type: 'text', text: 'msg2' }] }, parent_tool_use_id: null },
    { type: 'user', uuid: 'u3', session_id: 's', message: { content: 'msg3' }, parent_tool_use_id: null },
    { type: 'assistant', uuid: 'u4', session_id: 's', message: { content: [{ type: 'text', text: 'msg4' }] }, parent_tool_use_id: null },
    { type: 'user', uuid: 'u5', session_id: 's', message: { content: 'msg5' }, parent_tool_use_id: null },
  ]
  const reader = createConversationReader(mockSdk)
  const page = await reader.readPage('sess-1', { limit: 3 })
  assert.equal(page.messages.length, 3)
  assert.equal(page.messages[0].id, 'u3')
  assert.equal(page.messages[2].id, 'u5')
  assert.equal(page.hasMore, true)
})

test('readConversationPage with cursor returns messages before it', async () => {
  const mockSdk = async () => [
    { type: 'user', uuid: 'u1', session_id: 's', message: { content: 'msg1' }, parent_tool_use_id: null },
    { type: 'assistant', uuid: 'u2', session_id: 's', message: { content: [{ type: 'text', text: 'msg2' }] }, parent_tool_use_id: null },
    { type: 'user', uuid: 'u3', session_id: 's', message: { content: 'msg3' }, parent_tool_use_id: null },
    { type: 'assistant', uuid: 'u4', session_id: 's', message: { content: [{ type: 'text', text: 'msg4' }] }, parent_tool_use_id: null },
    { type: 'user', uuid: 'u5', session_id: 's', message: { content: 'msg5' }, parent_tool_use_id: null },
  ]
  const reader = createConversationReader(mockSdk)
  const page = await reader.readPage('sess-1', { limit: 2, before: 'u3' })
  assert.equal(page.messages.length, 2)
  assert.equal(page.messages[0].id, 'u1')
  assert.equal(page.messages[1].id, 'u2')
  assert.equal(page.hasMore, false)
})

test('readConversationPage hasMore is false when all messages fit', async () => {
  const mockSdk = async () => [
    { type: 'user', uuid: 'u1', session_id: 's', message: { content: 'msg1' }, parent_tool_use_id: null },
    { type: 'assistant', uuid: 'u2', session_id: 's', message: { content: [{ type: 'text', text: 'msg2' }] }, parent_tool_use_id: null },
  ]
  const reader = createConversationReader(mockSdk)
  const page = await reader.readPage('sess-1', { limit: 10 })
  assert.equal(page.messages.length, 2)
  assert.equal(page.hasMore, false)
})
