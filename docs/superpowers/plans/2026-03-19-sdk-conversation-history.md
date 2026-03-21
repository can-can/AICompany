# SDK Conversation History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace in-memory conversation history with SDK session transcript reading, add paginated loading, and stream new messages in real-time via SSE.

**Architecture:** The backend reads conversation history from the SDK's JSONL session transcript files on disk via `getSessionMessages()`. A new `/api/conversation` REST endpoint serves paginated history (cursor-based, newest-first). An EventEmitter on the role-manager emits SDK messages as they arrive in real-time; a new `/api/conversation/stream` SSE endpoint subscribes to these events and pushes them to connected dashboard clients. The frontend replaces its polling-based `conversationHistory` with an initial REST fetch + SSE subscription for live updates.

**Tech Stack:** Node.js, Express (SSE), Claude Agent SDK (`getSessionMessages`), EventEmitter, React, assistant-ui `useExternalStoreRuntime`, EventSource API

---

## File Structure

### Backend (modified)

| File | Action | Responsibility |
|---|---|---|
| `bin/lib/role-manager.js` | Modify | Add EventEmitter, emit `message` events from SDK loop and `sendInput`, remove `conversationHistory` array |
| `bin/lib/sdk-runner.js` | Modify | Accept `onMessage` callback, call it for each SDK message as it arrives (instead of batching) |
| `bin/lib/web-server.js` | Modify | Add `GET /api/conversation` (paginated) and `GET /api/conversation/stream` (SSE) endpoints |
| `bin/lib/conversation-reader.js` | Create | Thin wrapper around `getSessionMessages` that extracts text content from Anthropic message format |

### Frontend (modified)

| File | Action | Responsibility |
|---|---|---|
| `dashboard/src/lib/api.ts` | Modify | Add `fetchConversation()`, remove `conversationHistory` from `RoleStatus` type |
| `dashboard/src/lib/useAICompanyRuntime.ts` | Rewrite | Fetch initial history from REST, subscribe to SSE for real-time updates, support scroll-up pagination |
| `dashboard/src/components/ChatThread.tsx` | Modify | Wire up scroll-up-to-load-more via LoadMoreButton |

### Tests (modified/created)

| File | Action | Responsibility |
|---|---|---|
| `test/conversation-reader.test.js` | Create | Unit tests for message extraction and pagination logic |
| `test/role-manager.test.js` | Modify | Remove `conversationHistory` assertions, add EventEmitter assertions |
| `dashboard/__tests__/useAICompanyRuntime.test.ts` | Modify | Update to new `ConversationMessage` type and `convertMessage` signature |
| `dashboard/__tests__/api.test.ts` | Modify | Add `fetchConversation` test, remove `conversationHistory` from mock data |

---

### Task 1: Create conversation-reader module

Extract text content from SDK session messages into a simple format the dashboard can consume. Uses dependency injection for `getSessionMessages` to enable testing without the SDK.

**Files:**
- Create: `bin/lib/conversation-reader.js`
- Create: `test/conversation-reader.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/conversation-reader.test.js
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
  // Mock SDK: returns 5 messages in chronological order
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/conversation-reader.test.js`
Expected: FAIL with "Cannot find module" or "extractMessages is not a function"

- [ ] **Step 3: Write minimal implementation**

```js
// bin/lib/conversation-reader.js

/**
 * Extract text content from an SDK SessionMessage into a simple chat entry.
 * Returns null if the message has no text content blocks.
 *
 * Note: SessionMessage.message is typed as `unknown` in the SDK.
 * At runtime it follows the Anthropic API message format:
 * { role, content: string | Array<{type: 'text', text} | {type: 'tool_use', ...}> }
 */
function toEntry(msg) {
  const content = msg.message?.content
  let text

  if (typeof content === 'string') {
    text = content
  } else if (Array.isArray(content)) {
    text = content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join(' ')
  }

  if (!text || !text.trim()) return null

  return {
    role: msg.type, // 'user' | 'assistant'
    id: msg.uuid,
    text: text.trim(),
  }
}

/**
 * Convert an array of SDK SessionMessages to simple chat entries,
 * filtering out tool-only messages.
 */
export function extractMessages(sdkMessages) {
  return sdkMessages.map(toEntry).filter(Boolean)
}

/**
 * Create a conversation reader with an injected SDK function.
 * Uses dependency injection so tests can provide a mock getSessionMessages.
 *
 * @param {Function} getSessionMessages - SDK's getSessionMessages function
 * @returns {{ readPage: Function }}
 */
export function createConversationReader(getSessionMessages) {
  /**
   * Read a page of conversation history, newest messages first.
   *
   * The SDK returns messages in chronological order (oldest first).
   * We need newest-first for the "load older on scroll up" pattern.
   *
   * Strategy: Read ALL messages from the SDK (local JSONL files, fast),
   * filter to text-only, then slice for the requested page.
   *
   * @param {string} sessionId
   * @param {object} [options]
   * @param {number} [options.limit=10] - Messages per page
   * @param {string} [options.before] - Message UUID cursor - return messages before this one
   * @returns {Promise<{messages: Array, hasMore: boolean}>}
   */
  async function readPage(sessionId, { limit = 10, before } = {}) {
    const allSdk = await getSessionMessages(sessionId)
    const allMessages = extractMessages(allSdk)

    // Messages are chronological. Slice from the end for newest-first pages.
    let endIndex = allMessages.length
    if (before) {
      const cursorIdx = allMessages.findIndex(m => m.id === before)
      if (cursorIdx !== -1) endIndex = cursorIdx
    }

    const startIndex = Math.max(0, endIndex - limit)
    const page = allMessages.slice(startIndex, endIndex)

    return {
      messages: page,
      hasMore: startIndex > 0,
    }
  }

  return { readPage }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/conversation-reader.test.js`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add bin/lib/conversation-reader.js test/conversation-reader.test.js
git commit -m "feat: add conversation-reader module for SDK transcript extraction"
```

---

### Task 2: Add paginated `/api/conversation` endpoint

Serve conversation history from SDK session transcripts with cursor-based pagination.

**Files:**
- Modify: `bin/lib/web-server.js` (add route before SPA catch-all)

- [ ] **Step 1: Add the `/api/conversation` route to web-server.js**

Add this route **before** the SPA catch-all (`app.get('*')` on line 86) in `bin/lib/web-server.js`:

```js
  app.get('/api/conversation', async (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    const { role, limit, before } = req.query
    if (!role) {
      res.status(400).json({ error: 'role query parameter required' })
      return
    }
    const sessions = project.roleManager.getSessions()
    const sessionId = sessions[role]
    if (!sessionId) {
      res.json({ messages: [], hasMore: false })
      return
    }
    try {
      const { getSessionMessages } = await import('@anthropic-ai/claude-agent-sdk')
      const { createConversationReader } = await import('./conversation-reader.js')
      const reader = createConversationReader(getSessionMessages)
      const result = await reader.readPage(sessionId, {
        limit: parseInt(limit ?? '10', 10),
        before: before || undefined,
      })
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
```

Note: Uses dynamic `import()` for the SDK (same pattern as `sdk-runner.js` line 23) to avoid top-level import failures if the SDK is not configured.

- [ ] **Step 2: Run existing tests to verify nothing broke**

Run: `node --test test/role-manager.test.js && node --test test/conversation-reader.test.js`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add bin/lib/web-server.js
git commit -m "feat: add paginated /api/conversation endpoint reading SDK transcripts"
```

---

### Task 3: Add EventEmitter to role-manager and modify sdk-runner for real-time message emission

Make the SDK runner emit messages as they arrive (instead of batching), and have the role-manager expose an EventEmitter for SSE subscribers. Also emit human messages from `sendInput` immediately so SSE subscribers see them in real-time.

**Files:**
- Modify: `bin/lib/sdk-runner.js` (accept `onMessage` callback, call it per message)
- Modify: `bin/lib/role-manager.js` (add EventEmitter, wire to sdk-runner's `onMessage`, emit from `sendInput`, remove `conversationHistory`)

- [ ] **Step 1: Modify sdk-runner.js to accept an `onMessage` callback**

Replace the full `createSdkRunner` function in `bin/lib/sdk-runner.js`:

```js
export function createSdkRunner(projectDir, sessionsPath) {
  async function runAgent(task, role, sessionId, { prompt: overridePrompt, onMessage } = {}) {
    const { query } = await import('@anthropic-ai/claude-agent-sdk')

    const options = {
      cwd: join(projectDir, 'roles', role),
      permissionMode: process.env.AI_COMPANY_PERMISSION_MODE ?? 'bypassPermissions'
    }
    if (sessionId) options.resume = sessionId

    const prompt = overridePrompt ?? buildPrompt(task, role, projectDir)
    let lastSessionId = sessionId
    let resultStatus = 'unknown'
    const messages = []

    for await (const message of query({ prompt, options })) {
      if (message.type === 'result') {
        lastSessionId = message.session_id ?? lastSessionId
        resultStatus = message.subtype ?? 'done'
      } else if (message.type === 'assistant' && message.content) {
        const text = Array.isArray(message.content)
          ? message.content.filter(b => b.type === 'text').map(b => b.text).join('')
          : String(message.content)
        if (text) {
          messages.push(text)
          onMessage?.({ type: 'assistant', text, sessionId: lastSessionId })
        }
      } else if (message.type === 'user' && message.content) {
        const text = Array.isArray(message.content)
          ? message.content.filter(b => b.type === 'text').map(b => b.text).join('')
          : String(message.content)
        if (text) {
          onMessage?.({ type: 'user', text, sessionId: lastSessionId })
        }
      }
    }

    // Persist updated session id
    if (lastSessionId && lastSessionId !== sessionId) {
      let sessions = {}
      if (existsSync(sessionsPath)) {
        try { sessions = JSON.parse(readFileSync(sessionsPath, 'utf8')) } catch {}
      }
      sessions[role] = lastSessionId
      writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2))
    }

    return { sessionId: lastSessionId, resultStatus, messages }
  }

  return runAgent
}
```

- [ ] **Step 2: Modify role-manager.js — add EventEmitter, wire onMessage, emit from sendInput, remove conversationHistory**

**2a.** Add import at top of `bin/lib/role-manager.js`:

```js
import { EventEmitter } from 'node:events'
```

**2b.** Add emitter creation right after `const runners = {}` (line 4):

```js
  const emitter = new EventEmitter()
```

**2c.** Remove `conversationHistory: []` from the runner init object (line 17). The full init becomes:

```js
    runners[role] = {
      state: 'free',
      queue: [],
      sdkInFlight: false,
      currentTask: null,
      sessionId: null,
      dispatchChain: Promise.resolve(),
      _idleResolvers: [],
      lastMessages: [],
      inputQueue: [],
    }
```

**2d.** In `tryDispatch`, replace the human-input SDK call (around line 55) to pass `onMessage`:

```js
            const result = await sdkRunner(fresh, role, runner.sessionId, {
              prompt: humanMsg,
              onMessage: (msg) => emitter.emit('message', { role, ...msg })
            })
```

**2e.** Remove the `conversationHistory.push` block after the human-input SDK call (lines 59-61):

Delete:
```js
              for (const msg of result.messages) {
                runner.conversationHistory.push({ from: 'agent', text: msg, timestamp: Date.now() })
              }
```

**2f.** In `tryDispatch`, replace the new-task SDK call (around line 94) to pass `onMessage`:

```js
      const result = await sdkRunner(next, role, runner.sessionId, {
        onMessage: (msg) => emitter.emit('message', { role, ...msg })
      })
```

**2g.** Remove the `conversationHistory.push` block after the new-task SDK call (lines 98-100):

Delete:
```js
        for (const msg of result.messages) {
          runner.conversationHistory.push({ from: 'agent', text: msg, timestamp: Date.now() })
        }
```

**2h.** In `sendInput`, replace the `conversationHistory.push` (line 138) with an emitter emit:

```js
  function sendInput(role, message) {
    const runner = getRunner(role)
    runner.inputQueue.push(message)
    emitter.emit('message', { role, type: 'user', text: message })
    if (runner.state === 'waiting_human') {
      scheduleDispatch(role)
    }
  }
```

**2i.** Remove `conversationHistory` from `getStatus()` (line 157):

```js
      result[role] = {
        state: runner.state,
        activeTask: runner.currentTask ? { id: runner.currentTask.id, title: runner.currentTask.title } : null,
        queueDepth: runner.queue.length,
        lastMessages: runner.lastMessages,
      }
```

**2j.** Add `emitter` to the return object:

```js
  return { enqueue, getState, getStatus, scheduleDispatch, sendInput, loadSessions, getSessions, initializeSessions, restoreInProgressTasks, waitIdle, emitter }
```

- [ ] **Step 3: Update role-manager tests**

In `test/role-manager.test.js`:

Add this test at the end of the file:

```js
test('emitter fires message events during SDK dispatch', async () => {
  const receivedEvents = []
  const sdk = async (task, role, sessionId, opts) => {
    opts?.onMessage?.({ type: 'assistant', text: 'hello from agent', sessionId: 'sess-eng' })
    return { sessionId: 'sess-eng', resultStatus: 'done', messages: ['hello from agent'] }
  }
  const mgr = createRoleManager(['engineer'], sdk, makeMockReadTask('done'), createLogger())
  mgr.emitter.on('message', (evt) => receivedEvents.push(evt))
  mgr.enqueue(makeTask({ to: 'engineer' }))
  await mgr.waitIdle('engineer')
  assert.equal(receivedEvents.length, 1)
  assert.equal(receivedEvents[0].role, 'engineer')
  assert.equal(receivedEvents[0].text, 'hello from agent')
  assert.equal(receivedEvents[0].type, 'assistant')
})

test('sendInput emits human message to emitter immediately', () => {
  const receivedEvents = []
  const mgr = createRoleManager(['engineer'], makeMockSdk(), makeMockReadTask('in_progress'), createLogger())
  mgr.emitter.on('message', (evt) => receivedEvents.push(evt))
  // Manually set up waiting_human state so sendInput doesn't throw
  mgr.restoreInProgressTasks([makeTask({ to: 'engineer', status: 'in_progress' })])
  mgr.sendInput('engineer', 'hello from human')
  assert.equal(receivedEvents.length, 1)
  assert.equal(receivedEvents[0].role, 'engineer')
  assert.equal(receivedEvents[0].text, 'hello from human')
  assert.equal(receivedEvents[0].type, 'user')
})
```

- [ ] **Step 4: Run all tests**

Run: `node --test test/role-manager.test.js && node --test test/conversation-reader.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add bin/lib/sdk-runner.js bin/lib/role-manager.js test/role-manager.test.js
git commit -m "feat: add EventEmitter for real-time SDK message streaming, remove in-memory conversationHistory"
```

---

### Task 4: Add SSE `/api/conversation/stream` endpoint

Server-Sent Events endpoint that pushes real-time messages from the role-manager's EventEmitter to connected dashboard clients.

**Files:**
- Modify: `bin/lib/web-server.js` (add SSE route)

- [ ] **Step 1: Add SSE endpoint before the SPA catch-all**

Add this route to `bin/lib/web-server.js`, after the `/api/conversation` route and before the `app.get('*')` catch-all:

```js
  app.get('/api/conversation/stream', (req, res) => {
    const project = requireProject(req, res)
    if (!project) return
    const { role } = req.query
    if (!role) {
      res.status(400).json({ error: 'role query parameter required' })
      return
    }

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.flushHeaders()

    // Send initial connection event with current state
    const initialState = project.roleManager.getState(role)
    res.write(`data: ${JSON.stringify({ type: 'connected', state: initialState })}\n\n`)

    // Subscribe to role-manager's emitter for real-time messages
    const onMessage = (evt) => {
      if (evt.role !== role) return
      res.write(`data: ${JSON.stringify(evt)}\n\n`)
    }
    project.roleManager.emitter.on('message', onMessage)

    // Periodic state pings so dashboard knows when agent starts/stops
    const statusInterval = setInterval(() => {
      try {
        const state = project.roleManager.getState(role)
        res.write(`data: ${JSON.stringify({ type: 'state', state })}\n\n`)
      } catch {
        // role may not exist anymore
      }
    }, 2000)

    // Cleanup on disconnect
    req.on('close', () => {
      project.roleManager.emitter.off('message', onMessage)
      clearInterval(statusInterval)
    })
  })
```

- [ ] **Step 2: Verify the SPA catch-all is still the last route**

Confirm `app.get('*', ...)` remains the final route in `web-server.js`.

- [ ] **Step 3: Run existing tests**

Run: `node --test test/role-manager.test.js && node --test test/conversation-reader.test.js`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add bin/lib/web-server.js
git commit -m "feat: add SSE /api/conversation/stream endpoint for real-time messages"
```

---

### Task 5: Update dashboard API layer and tests

Add `fetchConversation()` function, remove `conversationHistory` from the `RoleStatus` type, update dashboard tests.

**Files:**
- Modify: `dashboard/src/lib/api.ts`
- Modify: `dashboard/__tests__/api.test.ts`

- [ ] **Step 1: Remove `conversationHistory` from `RoleStatus` type**

In `dashboard/src/lib/api.ts`, change `RoleStatus` (lines 8-13) to:

```ts
export type RoleStatus = {
  state: 'free' | 'working' | 'waiting_human' | 'ready'
  activeTask: { id: string; title: string } | null
  queueDepth: number
  lastMessages: string[]
}
```

- [ ] **Step 2: Add `ConversationMessage` type and `fetchConversation` function**

Add at the end of `dashboard/src/lib/api.ts`:

```ts
export type ConversationMessage = {
  role: 'user' | 'assistant'
  id: string
  text: string
}

export type ConversationPage = {
  messages: ConversationMessage[]
  hasMore: boolean
}

export async function fetchConversation(
  project: string,
  role: string,
  limit = 10,
  before?: string,
): Promise<ConversationPage> {
  const params = new URLSearchParams({ project, role, limit: String(limit) })
  if (before) params.set('before', before)
  const res = await fetch(`/api/conversation?${params}`)
  if (!res.ok) return { messages: [], hasMore: false }
  return res.json()
}
```

- [ ] **Step 3: Add `fetchConversation` test and remove `conversationHistory` from mock data**

In `dashboard/__tests__/api.test.ts`, add this test block and update any mock data that references `conversationHistory`:

Add after the `sendMessage` describe block:

```ts
describe('fetchConversation', () => {
  it('returns paginated messages', async () => {
    const data = {
      messages: [
        { role: 'user', id: 'u1', text: 'Hello' },
        { role: 'assistant', id: 'u2', text: 'Hi there' },
      ],
      hasMore: true,
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(data), { status: 200 })
    )
    const result = await fetchConversation('myapp', 'pm', 10)
    expect(result.messages).toHaveLength(2)
    expect(result.hasMore).toBe(true)
    expect(fetch).toHaveBeenCalledWith('/api/conversation?project=myapp&role=pm&limit=10')
  })

  it('passes before cursor when provided', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ messages: [], hasMore: false }), { status: 200 })
    )
    await fetchConversation('myapp', 'pm', 5, 'cursor-uuid')
    expect(fetch).toHaveBeenCalledWith('/api/conversation?project=myapp&role=pm&limit=5&before=cursor-uuid')
  })

  it('returns empty on error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 500 })
    )
    const result = await fetchConversation('myapp', 'pm')
    expect(result).toEqual({ messages: [], hasMore: false })
  })
})
```

Also update the import line to include `fetchConversation`:

```ts
import { fetchProjects, fetchStatus, fetchTasks, fetchLogs, sendMessage, fetchConversation } from '../src/lib/api'
```

- [ ] **Step 4: Build and run tests**

Run: `cd /Users/cancan/Projects/AICompany/dashboard && npx tsc --noEmit && npx vitest run __tests__/api.test.ts`
Expected: No type errors, all tests pass

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/api.ts dashboard/__tests__/api.test.ts
git commit -m "feat: add fetchConversation API function, remove conversationHistory from RoleStatus"
```

---

### Task 6: Rewrite `useAICompanyRuntime` hook and update its tests

Replace the polling-based `conversationHistory` approach with:
1. Initial REST fetch of last 10 messages from `/api/conversation`
2. SSE subscription to `/api/conversation/stream` for real-time updates
3. `loadMore()` function for scroll-up pagination

Human messages from `sendInput` are emitted to SSE immediately (Task 3), so optimistic UI is not needed for those. SSE messages from the SDK include the session ID but not the SDK's message UUID. To avoid duplicate messages when SSE messages and REST-fetched messages overlap, we deduplicate by text content when appending SSE messages.

**Files:**
- Rewrite: `dashboard/src/lib/useAICompanyRuntime.ts`
- Modify: `dashboard/__tests__/useAICompanyRuntime.test.ts`

- [ ] **Step 1: Rewrite the hook**

```ts
// dashboard/src/lib/useAICompanyRuntime.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  useExternalStoreRuntime,
  type ThreadMessageLike,
  type AppendMessage,
} from '@assistant-ui/react'
import {
  fetchStatus,
  fetchConversation,
  sendMessage,
  type ConversationMessage,
  type RoleStatus,
  type ProjectStatus,
} from './api'

export function convertMessage(entry: ConversationMessage, index: number): ThreadMessageLike {
  return {
    id: entry.id,
    role: entry.role === 'user' ? 'user' : 'assistant',
    content: [{ type: 'text' as const, text: entry.text }],
  }
}

export function useAICompanyRuntime(project: string, role: string) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [roleStatus, setRoleStatus] = useState<RoleStatus | null>(null)
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null)
  const [hasMore, setHasMore] = useState(false)
  // Track the oldest REST-fetched message ID for pagination cursoring.
  // SSE messages get synthetic IDs that don't exist in the SDK transcript,
  // so we must never use them as the `before` cursor.
  const oldestRestIdRef = useRef<string | null>(null)

  // Load initial page of messages
  useEffect(() => {
    let cancelled = false
    async function load() {
      const page = await fetchConversation(project, role)
      if (cancelled) return
      setMessages(page.messages)
      setHasMore(page.hasMore)
      if (page.messages.length > 0) {
        oldestRestIdRef.current = page.messages[0].id
      }
    }
    load()
    return () => { cancelled = true }
  }, [project, role])

  // SSE subscription for real-time messages and state updates
  useEffect(() => {
    const params = new URLSearchParams({ project, role })
    const sse = new EventSource(`/api/conversation/stream?${params}`)

    sse.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'connected') {
        // Initial connection includes current state
        if (data.state) {
          setRoleStatus(prev => {
            if (prev) return { ...prev, state: data.state }
            // Bootstrap a minimal RoleStatus if we haven't polled yet
            return { state: data.state, activeTask: null, queueDepth: 0, lastMessages: [] }
          })
        }
        return
      }

      if (data.type === 'state') {
        setRoleStatus(prev => {
          if (prev) return { ...prev, state: data.state }
          return { state: data.state, activeTask: null, queueDepth: 0, lastMessages: [] }
        })
        return
      }

      // Real-time message from SDK or sendInput
      if (data.type === 'assistant' || data.type === 'user') {
        const msg: ConversationMessage = {
          role: data.type,
          id: 'sse-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          text: data.text,
        }
        setMessages(prev => {
          // Deduplicate: skip if the last message has the same text and role
          const last = prev[prev.length - 1]
          if (last && last.text === msg.text && last.role === msg.role) return prev
          return [...prev, msg]
        })
      }
    }

    sse.onerror = () => {
      // EventSource auto-reconnects; no action needed
    }

    return () => sse.close()
  }, [project, role])

  // Poll status (for activeTask, queueDepth, etc.) at a slower rate
  // since state changes now come via SSE
  const poll = useCallback(async () => {
    const data = await fetchStatus(project)
    if (!data) return
    setProjectStatus(data)
    const r = data.roles[role]
    if (r) setRoleStatus(r)
  }, [project, role])

  useEffect(() => {
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [poll])

  // Load older messages (scroll-up pagination)
  // Uses oldestRestIdRef as cursor instead of messages[0].id, because
  // SSE messages have synthetic IDs that don't exist in the SDK transcript.
  const loadMore = useCallback(async () => {
    if (!hasMore || !oldestRestIdRef.current) return
    const page = await fetchConversation(project, role, 10, oldestRestIdRef.current)
    setMessages(prev => [...page.messages, ...prev])
    setHasMore(page.hasMore)
    if (page.messages.length > 0) {
      oldestRestIdRef.current = page.messages[0].id
    }
  }, [project, role, hasMore])

  const isRunning = roleStatus?.state === 'working' || roleStatus?.state === 'ready'
  const canSend = roleStatus?.state === 'waiting_human'

  const onNew = useCallback(async (message: AppendMessage) => {
    if (!canSend) return
    const textPart = message.content.find((c) => c.type === 'text')
    if (!textPart || textPart.type !== 'text') return
    // Human message will arrive via SSE (emitted by sendInput on the server)
    await sendMessage(project, role, textPart.text)
  }, [project, role, canSend])

  const runtime = useExternalStoreRuntime({
    messages,
    convertMessage,
    isRunning,
    onNew,
  })

  return { runtime, roleStatus, projectStatus, canSend, hasMore, loadMore }
}
```

- [ ] **Step 2: Rewrite dashboard tests for new convertMessage signature**

Replace `dashboard/__tests__/useAICompanyRuntime.test.ts`:

```ts
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
```

- [ ] **Step 3: Build and run tests**

Run: `cd /Users/cancan/Projects/AICompany/dashboard && npx tsc --noEmit && npx vitest run`
Expected: No type errors, all tests pass

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/useAICompanyRuntime.ts dashboard/__tests__/useAICompanyRuntime.test.ts
git commit -m "feat: rewrite useAICompanyRuntime with REST pagination + SSE streaming"
```

---

### Task 7: Add scroll-up-to-load-more in ChatThread

Wire up the `loadMore` function so scrolling to the top loads older messages via a "Load older messages" button.

**Files:**
- Modify: `dashboard/src/components/ChatThread.tsx`

- [ ] **Step 1: Rewrite ChatThread.tsx with LoadMoreButton**

Replace the full contents of `dashboard/src/components/ChatThread.tsx`:

```tsx
import { useEffect, useState } from 'react'
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  MessagePrimitive,
  MessagePartPrimitive,
  ComposerPrimitive,
  useMessage,
} from '@assistant-ui/react'
import type { ProjectStatus } from '../lib/api'
import { useAICompanyRuntime } from '../lib/useAICompanyRuntime'

const statusLabels: Record<string, string> = {
  working: 'Agent is working...',
  free: 'Agent is idle \u2014 no active task',
  ready: 'Agent is finishing up...',
  waiting_human: '',
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end px-4 py-2">
      <div className="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2 text-sm">
        <MessagePrimitive.Content
          components={{ Text: TextPart }}
        />
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-start px-4 py-2">
      <div className="max-w-[80%] bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md px-4 py-2 text-sm">
        <MessagePrimitive.Content
          components={{ Text: TextPart }}
        />
      </div>
    </MessagePrimitive.Root>
  )
}

function TextPart() {
  return <MessagePartPrimitive.Text component="p" className="whitespace-pre-wrap" />
}

function Composer({ canSend }: { canSend: boolean }) {
  return (
    <ComposerPrimitive.Root className="flex items-end gap-2 border-t border-gray-200 bg-white px-4 py-3">
      <ComposerPrimitive.Input
        placeholder={canSend ? 'Type a message...' : 'Waiting for agent...'}
        disabled={!canSend}
        className="flex-1 resize-none rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
        autoFocus
      />
      <ComposerPrimitive.Send
        disabled={!canSend}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Send
      </ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  )
}

function ThreadMessages() {
  const message = useMessage()
  if (message.role === 'user') return <UserMessage />
  return <AssistantMessage />
}

function LoadMoreButton({ hasMore, onLoadMore }: { hasMore: boolean; onLoadMore: () => void }) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    await onLoadMore()
    setLoading(false)
  }

  if (!hasMore) return null

  return (
    <div className="flex justify-center py-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
      >
        {loading ? 'Loading...' : 'Load older messages'}
      </button>
    </div>
  )
}

export default function ChatThread({ project, role, onStatusChange }: { project: string; role: string; onStatusChange?: (status: ProjectStatus | null) => void }) {
  const { runtime, roleStatus, projectStatus, canSend, hasMore, loadMore } = useAICompanyRuntime(project, role)

  useEffect(() => {
    onStatusChange?.(projectStatus)
  }, [projectStatus, onStatusChange])

  return (
    <div className="flex flex-col h-full">
      <AssistantRuntimeProvider runtime={runtime}>
        <div className="flex-1 overflow-y-auto">
          <LoadMoreButton hasMore={hasMore} onLoadMore={loadMore} />
          <ThreadPrimitive.Viewport className="flex flex-col">
            <ThreadPrimitive.Messages>
              {() => <ThreadMessages />}
            </ThreadPrimitive.Messages>
          </ThreadPrimitive.Viewport>
        </div>
        <Composer canSend={canSend} />
      </AssistantRuntimeProvider>
      {!canSend && roleStatus && (
        <div className="px-4 py-2 text-sm text-gray-500 text-center bg-gray-50 border-t border-gray-200">
          {statusLabels[roleStatus.state] ?? roleStatus.state}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build to verify types**

Run: `cd /Users/cancan/Projects/AICompany/dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Build the dashboard**

Run: `cd /Users/cancan/Projects/AICompany/dashboard && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/ChatThread.tsx
git commit -m "feat: add Load More button for paginated conversation history"
```

---

### Task 8: Integration test — restart server and verify end-to-end

Verify the full flow works: server starts, dashboard loads, conversation history appears from SDK transcripts, SSE streams state updates.

**Files:**
- No code changes — this is a verification task

- [ ] **Step 1: Run all tests**

Run: `node --test test/role-manager.test.js && node --test test/conversation-reader.test.js && cd /Users/cancan/Projects/AICompany/dashboard && npx vitest run`
Expected: All PASS

- [ ] **Step 2: Build the dashboard**

Run: `cd /Users/cancan/Projects/AICompany/dashboard && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Restart the server**

Run: `ai-company stop && ai-company start`
Expected: Server starts on port 4000

- [ ] **Step 4: Verify `/api/conversation` returns data**

Run: `curl -s "http://localhost:4000/api/conversation?project=RabT&role=qa&limit=5" | head -c 500`
Expected: JSON response with `messages` array containing objects with `{role, id, text}` and a `hasMore` boolean

- [ ] **Step 5: Verify `/api/conversation/stream` returns SSE**

Run: `timeout 5 curl -s -N "http://localhost:4000/api/conversation/stream?project=RabT&role=qa" || true`
Expected: Receives `data: {"type":"connected","state":"..."}` followed by periodic `data: {"type":"state","state":"..."}` events

- [ ] **Step 6: Verify dashboard loads in browser**

Run: `curl -s http://localhost:4000/ | head -c 200`
Expected: HTML response (React SPA)

- [ ] **Step 7: Run UI smoke test**

Use the frontend-ui-testing skill to verify:
- Chat view displays conversation history from SDK transcripts
- Load More button appears and loads older messages when clicked
- Status label updates reflect SSE state changes
