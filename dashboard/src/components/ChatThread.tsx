import { useEffect, useRef, useCallback, useState } from 'react'
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  useMessage,
} from '@assistant-ui/react'
import type { ProjectStatus, ConversationMessage, RoleStatus } from '../lib/api'
import { stopAgent, clearConversation } from '../lib/api'
import { useAICompanyData, useAICompanyRuntime } from '../lib/useAICompanyRuntime'
import MarkdownText from './MarkdownText'
import ToolCallUI from './ToolCallUI'
import CollapsibleMessage from './CollapsibleMessage'
import SlashCommandMenu, { useSlashCommands } from './SlashCommandMenu'

const statusLabels: Record<string, string> = {
  working: 'Agent is working...',
  free: 'Agent is idle \u2014 no active task',
  ready: 'Agent is finishing up...',
  waiting_human: '',
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end px-4 py-2">
      <div className="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2 text-sm prose-invert">
        <CollapsibleMessage fadeColor="from-blue-600">
          <MessagePrimitive.Content
            components={{ Text: MarkdownText }}
          />
        </CollapsibleMessage>
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-start px-4 py-2">
      <div className="max-w-[80%] bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md px-4 py-2 text-sm">
        <CollapsibleMessage fadeColor="from-gray-100">
          <MessagePrimitive.Content
            components={{
              Text: MarkdownText,
              tools: { Fallback: ToolCallUI },
            }}
          />
        </CollapsibleMessage>
      </div>
    </MessagePrimitive.Root>
  )
}

function Composer({ project, role, onClearMessages }: { project: string; role: string; onClearMessages: () => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const onExecute = useCallback((command: string) => {
    switch (command) {
      case 'stop':
        stopAgent(project, role)
        break
      case 'clear':
        clearConversation(project, role)
        onClearMessages()
        break
      case 'help':
        break
    }
  }, [project, role, onClearMessages])

  const { menuOpen, filtered, selectedIndex, setSelectedIndex, handleInput, handleKeyDown, execute } = useSlashCommands(textareaRef, onExecute)

  return (
    <ComposerPrimitive.Root className="relative flex items-end gap-2 border-t border-gray-200 bg-white px-4 py-3">
      {menuOpen && (
        <SlashCommandMenu
          commands={filtered}
          selectedIndex={selectedIndex}
          onSelect={(value) => {
            execute(value)
          }}
          onHover={setSelectedIndex}
        />
      )}
      <ComposerPrimitive.Input
        ref={textareaRef}
        placeholder="Type a message..."
        className="flex-1 resize-none rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        autoFocus
        onInput={handleInput}
        onKeyDown={handleKeyDown}
      />
      <ComposerPrimitive.Send
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

function LoadMoreSentinel({ hasMore, onLoadMore }: { hasMore: boolean; onLoadMore: () => Promise<void> }) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  const handleLoad = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    await onLoadMore()
    setLoading(false)
    loadingRef.current = false
  }, [onLoadMore])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) handleLoad() },
      { threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, handleLoad])

  if (!hasMore) return null

  return (
    <div ref={sentinelRef} className="flex justify-center py-3">
      {loading && <span className="text-sm text-gray-400">Loading...</span>}
    </div>
  )
}

/**
 * Inner component that creates the assistant-ui runtime.
 * Only mounted AFTER initial messages have loaded, so the runtime
 * starts with actual messages (avoiding empty→full remount).
 */
function ChatThreadInner({
  project,
  role,
  messages,
  roleStatus,
  projectStatus,
  hasMore,
  loadMore,
  onClearMessages,
}: {
  project: string
  role: string
  messages: ConversationMessage[]
  roleStatus: RoleStatus | null
  projectStatus: ProjectStatus | null
  hasMore: boolean
  loadMore: () => Promise<void>
  onClearMessages: () => void
}) {
  const { runtime } = useAICompanyRuntime(project, role, messages, roleStatus, projectStatus)
  const [stopping, setStopping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  // Track whether user is at the bottom of the scroll container
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const threshold = 50
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }, [])

  // Auto-scroll to bottom when new messages arrive (only if already at bottom)
  const prevMessageCountRef = useRef(messages.length)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (messages.length > prevMessageCountRef.current) {
      if (isAtBottomRef.current) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          el.scrollTo({ top: el.scrollHeight })
        })
      }
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length])

  // Scroll to bottom on initial load
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  const handleStop = async () => {
    setStopping(true)
    try {
      await stopAgent(project, role)
    } catch {
      // ignore — state will update via SSE/polling
    } finally {
      setStopping(false)
    }
  }

  return (
    <>
      <AssistantRuntimeProvider runtime={runtime}>
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
          <LoadMoreSentinel hasMore={hasMore} onLoadMore={loadMore} />
          <ThreadPrimitive.Viewport className="flex flex-col">
            <ThreadPrimitive.Messages>
              {() => <ThreadMessages />}
            </ThreadPrimitive.Messages>
          </ThreadPrimitive.Viewport>
        </div>
        <Composer project={project} role={role} onClearMessages={onClearMessages} />
      </AssistantRuntimeProvider>
      {roleStatus && (roleStatus.state === 'working' || roleStatus.state === 'ready') && (
        <div className="flex items-center justify-center gap-3 px-4 py-2 text-sm text-gray-500 bg-gray-50 border-t border-gray-200">
          <span>{statusLabels[roleStatus.state] ?? roleStatus.state}</span>
          {roleStatus.state === 'working' && (
            <button
              onClick={handleStop}
              disabled={stopping}
              className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {stopping ? 'Stopping...' : 'Stop'}
            </button>
          )}
        </div>
      )}
    </>
  )
}

export default function ChatThread({ project, role, onStatusChange }: { project: string; role: string; onStatusChange?: (status: ProjectStatus | null) => void }) {
  const { messages, setMessages, roleStatus, projectStatus, hasMore, loadMore, initialLoaded } = useAICompanyData(project, role)

  useEffect(() => {
    onStatusChange?.(projectStatus)
  }, [projectStatus, onStatusChange])

  const handleClearMessages = useCallback(() => {
    setMessages([])
  }, [setMessages])

  if (!initialLoaded) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <ChatThreadInner
        key={role}
        project={project}
        role={role}
        messages={messages}
        roleStatus={roleStatus}
        projectStatus={projectStatus}
        hasMore={hasMore}
        loadMore={loadMore}
        onClearMessages={handleClearMessages}
      />
    </div>
  )
}
