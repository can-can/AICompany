import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchStatus, fetchTasks, fetchLogs, type ProjectStatus, type TaskItem, type LogEntry } from '../lib/api'
import RoleCard from '../components/RoleCard'
import TaskTable from '../components/TaskTable'
import LogFeed from '../components/LogFeed'

export default function DashboardView() {
  const { project } = useParams<{ project: string }>()
  const [status, setStatus] = useState<ProjectStatus | null>(null)
  const [offline, setOffline] = useState(false)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    if (!project) return
    async function poll() {
      const s = await fetchStatus(project!)
      if (s === null) {
        setOffline(true)
        return
      }
      setOffline(false)
      setStatus(s)
      const [t, l] = await Promise.all([fetchTasks(project!), fetchLogs(project!)])
      setTasks(t)
      setLogs(l)
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [project])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-2">
        <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">All Projects</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-semibold text-gray-900">{project}</h1>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        {offline ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg font-medium">Project is offline</p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Roles</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {status && Object.entries(status.roles).map(([name, role]) => (
                  <RoleCard key={name} name={name} role={role} project={project!} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Tasks</h2>
              <TaskTable tasks={tasks} />
            </section>

            <section>
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Log</h2>
              <LogFeed logs={logs} />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
