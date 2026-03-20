import { useEffect } from 'react'
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

export default function ChatThread({ project, role, onStatusChange }: { project: string; role: string; onStatusChange?: (status: ProjectStatus | null) => void }) {
  const { runtime, roleStatus, projectStatus, canSend } = useAICompanyRuntime(project, role)

  useEffect(() => {
    onStatusChange?.(projectStatus)
  }, [projectStatus, onStatusChange])

  return (
    <div className="flex flex-col h-full">
      <AssistantRuntimeProvider runtime={runtime}>
        <div className="flex-1 overflow-y-auto">
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
