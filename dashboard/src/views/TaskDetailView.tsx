import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { fetchTask, updateTaskStatus, type TaskDetail } from '../lib/api'

const badgeColor: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-amber-50 text-amber-700',
  done: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
}

const statuses = ['pending', 'in_progress', 'done', 'rejected']

export default function TaskDetailView() {
  const { project, taskId } = useParams<{ project: string; taskId: string }>()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!project || !taskId) return
    fetchTask(project, taskId).then(t => {
      if (t) setTask(t)
      else setError('Task not found')
    })
  }, [project, taskId])

  const handleStatusChange = async (newStatus: string) => {
    if (!project || !taskId || !task || newStatus === task.status) return
    setUpdating(true)
    try {
      await updateTaskStatus(project, taskId, newStatus)
      setTask({ ...task, status: newStatus, updated: new Date().toISOString().slice(0, 10) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setUpdating(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
        {error}
      </div>
    )
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-2 text-sm">
        <Link to="/" className="text-gray-400 hover:text-gray-600">All Projects</Link>
        <span className="text-gray-300">/</span>
        <Link to={`/${project}`} className="text-gray-400 hover:text-gray-600">{project}</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-900 font-medium">Task #{task.id}</span>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h1 className="text-xl font-semibold text-gray-900">{task.title}</h1>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 block">Status</span>
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updating}
                className={`mt-1 px-2 py-1 rounded-md text-xs font-medium border cursor-pointer ${badgeColor[task.status] ?? badgeColor.pending} disabled:opacity-50`}
              >
                {statuses.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-gray-500 block">Priority</span>
              <span className="text-gray-900">{task.priority}</span>
            </div>
            <div>
              <span className="text-gray-500 block">From</span>
              <span className="text-gray-900">{task.from ?? '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">To</span>
              <span className="text-gray-900">{task.to ?? '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Owner</span>
              <span className="text-gray-900">{task.owner ?? '-'}</span>
            </div>
            {task.parent && (
              <div>
                <span className="text-gray-500 block">Parent</span>
                <Link to={`/${project}/task/${task.parent}`} className="text-blue-600 hover:text-blue-800">
                  #{task.parent}
                </Link>
              </div>
            )}
            <div>
              <span className="text-gray-500 block">Created</span>
              <span className="text-gray-400">{task.created}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Updated</span>
              <span className="text-gray-400">{task.updated}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.body}</ReactMarkdown>
          </div>
        </div>
      </main>
    </div>
  )
}
