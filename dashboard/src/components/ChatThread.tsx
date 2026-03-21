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

function Composer() {
  return (
    <ComposerPrimitive.Root className="flex items-end gap-2 border-t border-gray-200 bg-white px-4 py-3">
      <ComposerPrimitive.Input
        placeholder="Type a message..."
        className="flex-1 resize-none rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        autoFocus
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
  const { runtime, roleStatus, projectStatus, hasMore, loadMore } = useAICompanyRuntime(project, role)

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
        <Composer />
      </AssistantRuntimeProvider>
      {roleStatus && (roleStatus.state === 'working' || roleStatus.state === 'ready') && (
        <div className="px-4 py-2 text-sm text-gray-500 text-center bg-gray-50 border-t border-gray-200">
          {statusLabels[roleStatus.state] ?? roleStatus.state}
        </div>
      )}
    </div>
  )
}
