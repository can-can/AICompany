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
  type ContentPart,
  type RoleStatus,
  type ProjectStatus,
} from './api'

type JSONValue = string | number | boolean | null | { [key: string]: JSONValue } | JSONValue[]

type MappedPart =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: { readonly [key: string]: JSONValue }; result?: unknown }

function mapContentParts(parts: ContentPart[]): MappedPart[] {
  const mapped: MappedPart[] = []
  // Build a lookup of tool_use id -> tool_result for pairing
  const resultsByToolId = new Map<string, unknown>()
  for (const p of parts) {
    if (p.type === 'tool_result') {
      resultsByToolId.set(p.tool_use_id, p.content)
    }
  }
  for (const part of parts) {
    if (part.type === 'text') {
      mapped.push({ type: 'text' as const, text: part.text })
    } else if (part.type === 'tool_use') {
      const result = resultsByToolId.get(part.id)
      mapped.push({
        type: 'tool-call' as const,
        toolCallId: part.id,
        toolName: part.name,
        args: (part.input ?? {}) as { readonly [key: string]: JSONValue },
        result,
      })
    }
  }
  return mapped
}

export function convertMessage(entry: ConversationMessage, _index: number): ThreadMessageLike {
  const content = entry.content && entry.content.length > 0
    ? mapContentParts(entry.content)
    : [{ type: 'text' as const, text: entry.text }]

  return {
    id: entry.id,
    role: entry.role === 'user' ? 'user' : 'assistant',
    content,
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
          content: data.content,
        }
        setMessages(prev => [...prev, msg])
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

  // Don't pass isRunning=true to assistant-ui — it blocks Enter-to-submit
  // in ComposerPrimitive.Input. We show working/ready state in our own status bar.
  const isRunning = false
  const canSend = roleStatus != null

  const onNew = useCallback(async (message: AppendMessage) => {
    if (!roleStatus) return
    const textPart = message.content.find((c) => c.type === 'text')
    if (!textPart || textPart.type !== 'text') return
    // Human message will arrive via SSE (emitted by sendInput on the server)
    await sendMessage(project, role, textPart.text)
  }, [project, role, roleStatus])

  const runtime = useExternalStoreRuntime({
    messages,
    convertMessage,
    isRunning,
    onNew,
  })

  return { runtime, roleStatus, projectStatus, canSend, hasMore, loadMore }
}
