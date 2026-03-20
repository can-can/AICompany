import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchStatus, type ProjectStatus } from '../lib/api'
import RoleSidebar from '../components/RoleSidebar'
import ChatThread from '../components/ChatThread'

export default function ChatView() {
  const { project, role } = useParams<{ project: string; role: string }>()
  const [status, setStatus] = useState<ProjectStatus | null>(null)

  useEffect(() => {
    if (!project) return
    fetchStatus(project).then((s) => s && setStatus(s))
    const id = setInterval(() => {
      fetchStatus(project).then((s) => s && setStatus(s))
    }, 3000)
    return () => clearInterval(id)
  }, [project])

  const activeTask = status?.roles[role!]?.activeTask

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-2 text-sm shrink-0">
        <Link to="/" className="text-gray-400 hover:text-gray-600">All Projects</Link>
        <span className="text-gray-300">/</span>
        <Link to={`/${encodeURIComponent(project!)}`} className="text-gray-400 hover:text-gray-600">{project}</Link>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-gray-900 uppercase">{role}</span>
        {activeTask && (
          <span className="ml-4 text-gray-400">
            #{activeTask.id} {activeTask.title}
          </span>
        )}
      </header>
      <div className="flex flex-1 overflow-hidden">
        <RoleSidebar status={status} />
        <main className="flex-1 flex flex-col overflow-hidden">
          {project && role && <ChatThread project={project} role={role} />}
        </main>
      </div>
    </div>
  )
}
