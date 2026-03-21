import { useState } from 'react'

export default function ToolCallUI({ toolName, args, result }: { toolName: string; args: unknown; result?: unknown }) {
  const [expanded, setExpanded] = useState(false)

  const hasArgs = Boolean(args && typeof args === 'object' && Object.keys(args as Record<string, unknown>).length > 0)
  const hasResult = result !== undefined && result !== null

  return (
    <div className="my-2 rounded-lg border border-gray-200 bg-gray-50 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 rounded-lg"
      >
        <span className="text-gray-400">{expanded ? '▼' : '▶'}</span>
        <span className="font-mono font-medium text-gray-700">{toolName}</span>
        {hasResult && (
          <span className="ml-auto text-green-600">completed</span>
        )}
        {!hasResult && (
          <span className="ml-auto text-yellow-600">pending</span>
        )}
      </button>
      {expanded && (
        <div className="border-t border-gray-200 px-3 py-2 space-y-2">
          {hasArgs && (
            <div>
              <div className="text-gray-500 mb-1">Arguments</div>
              <pre className="overflow-x-auto rounded bg-gray-900 p-2 text-gray-100">
                {JSON.stringify(args, null, 2) as string}
              </pre>
            </div>
          )}
          {hasResult && (
            <div>
              <div className="text-gray-500 mb-1">Result</div>
              <pre className="overflow-x-auto rounded bg-gray-900 p-2 text-gray-100">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2) as string}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
