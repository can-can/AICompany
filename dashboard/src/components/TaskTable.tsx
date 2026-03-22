import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TaskItem } from '../lib/api'

const badgeColor: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-amber-50 text-amber-700',
  done: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
}

const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }

export default function TaskTable({ tasks, project }: { tasks: TaskItem[]; project: string }) {
  const navigate = useNavigate()
  const [showDone, setShowDone] = useState(false)

  const sorted = useMemo(() => {
    const filtered = showDone ? tasks : tasks.filter(t => t.status !== 'done')
    return [...filtered].sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 3
      const pb = priorityOrder[b.priority] ?? 3
      if (pa !== pb) return pa - pb
      return (b.created ?? '').localeCompare(a.created ?? '')
    })
  }, [tasks, showDone])

  const doneCount = tasks.filter(t => t.status === 'done').length

  return (
    <div className="overflow-x-auto">
      {doneCount > 0 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setShowDone(v => !v)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {showDone ? 'Hide done' : `Show done (${doneCount})`}
          </button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500 font-medium">
            <th className="py-2 px-3">ID</th>
            <th className="py-2 px-3">Title</th>
            <th className="py-2 px-3">From</th>
            <th className="py-2 px-3">To</th>
            <th className="py-2 px-3">Owner</th>
            <th className="py-2 px-3">Status</th>
            <th className="py-2 px-3">Priority</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr
              key={t.id}
              onClick={() => navigate(`/${encodeURIComponent(project)}/task/${t.id}`)}
              className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
            >
              <td className="py-2 px-3 text-gray-400">{t.id}</td>
              <td className="py-2 px-3 text-blue-600">{t.title}</td>
              <td className="py-2 px-3 text-gray-400">{t.from ?? '-'}</td>
              <td className="py-2 px-3 text-gray-900">{t.to ?? '-'}</td>
              <td className="py-2 px-3 text-gray-400">{t.owner ?? '-'}</td>
              <td className="py-2 px-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor[t.status] ?? badgeColor.pending}`}>
                  {t.status}
                </span>
              </td>
              <td className="py-2 px-3 text-gray-400">{t.priority ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
