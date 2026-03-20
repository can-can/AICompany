import { useState, useEffect, useCallback } from 'react'
import {
  useExternalStoreRuntime,
  type ThreadMessageLike,
  type AppendMessage,
} from '@assistant-ui/react'
import { fetchStatus, sendMessage, type RoleStatus, type ProjectStatus } from './api'

type HistoryEntry = { from: 'agent' | 'human'; text: string; timestamp: number }

export function convertMessage(entry: HistoryEntry, index: number): ThreadMessageLike {
  return {
    id: `msg-${index}`,
    role: entry.from === 'human' ? 'user' : 'assistant',
    content: [{ type: 'text' as const, text: entry.text }],
    createdAt: new Date(entry.timestamp),
  }
}

export function useAICompanyRuntime(project: string, role: string) {
  const [messages, setMessages] = useState<HistoryEntry[]>([])
  const [roleStatus, setRoleStatus] = useState<RoleStatus | null>(null)
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null)

  const poll = useCallback(async () => {
    const data = await fetchStatus(project)
    if (!data) return
    setProjectStatus(data)
    const r = data.roles[role]
    if (r) {
      setRoleStatus(r)
      setMessages(r.conversationHistory)
    }
  }, [project, role])

  useEffect(() => {
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [poll])

  const isRunning = roleStatus?.state === 'working' || roleStatus?.state === 'ready'
  const canSend = roleStatus?.state === 'waiting_human'

  const onNew = useCallback(async (message: AppendMessage) => {
    if (!canSend) return
    const textPart = message.content.find((c) => c.type === 'text')
    if (!textPart || textPart.type !== 'text') return
    await sendMessage(project, role, textPart.text)
    await poll()
  }, [project, role, poll, canSend])

  const runtime = useExternalStoreRuntime({
    messages,
    convertMessage,
    isRunning,
    onNew,
  })

  return { runtime, roleStatus, projectStatus, canSend }
}
