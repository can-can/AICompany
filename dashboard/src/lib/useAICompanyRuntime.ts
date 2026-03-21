import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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

/**
 * Manages data loading (messages, SSE, polling) separately from the runtime.
 * Returns data + setters so a child component can create the runtime after initial load.
 */
export function useAICompanyData(project: string, role: string) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [roleStatus, setRoleStatus] = useState<RoleStatus | null>(null)
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const oldestRestIdRef = useRef<string | null>(null)

  // Load initial page of messages
  useEffect(() => {
    let cancelled = false
    async function load() {
      const page = await fetchConversation(project, role)
      if (cancelled) return
      setMessages(page.messages)
      setHasMore(page.hasMore)
      setInitialLoaded(true)
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
        if (data.state) {
          setRoleStatus(prev => {
            if (prev) return { ...prev, state: data.state }
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

    sse.onerror = () => {}

    return () => sse.close()
  }, [project, role])

  // Poll status
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

  const loadMore = useCallback(async () => {
    if (!hasMore || !oldestRestIdRef.current) return
    const page = await fetchConversation(project, role, 10, oldestRestIdRef.current)
    setMessages(prev => [...page.messages, ...prev])
    setHasMore(page.hasMore)
    if (page.messages.length > 0) {
      oldestRestIdRef.current = page.messages[0].id
    }
  }, [project, role, hasMore])

  return { messages, setMessages, roleStatus, projectStatus, hasMore, loadMore, initialLoaded }
}

/**
 * Creates the assistant-ui runtime from already-loaded data.
 * This hook should only be called AFTER initial messages have loaded,
 * so the runtime starts with actual messages (avoiding the empty→full
 * transition that causes assistant-ui to remount the thread).
 */
export function useAICompanyRuntime(
  project: string,
  role: string,
  messages: ConversationMessage[],
  roleStatus: RoleStatus | null,
  _projectStatus: ProjectStatus | null,
) {
  const isRunning = false
  const canSend = roleStatus != null

  const roleStatusRef = useRef(roleStatus)
  roleStatusRef.current = roleStatus

  const onNew = useCallback(async (message: AppendMessage) => {
    if (!roleStatusRef.current) return
    const textPart = message.content.find((c) => c.type === 'text')
    if (!textPart || textPart.type !== 'text') return
    await sendMessage(project, role, textPart.text)
  }, [project, role])

  const convertMessageStable = useMemo(() => convertMessage, [])

  const store = useMemo(() => ({
    messages,
    convertMessage: convertMessageStable,
    isRunning,
    onNew,
  }), [messages, convertMessageStable, isRunning, onNew])

  const runtime = useExternalStoreRuntime(store)

  return { runtime, canSend }
}
