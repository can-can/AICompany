import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchProjects, type Project } from '../lib/api'

export default function ProjectListView() {
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    fetchProjects().then(setProjects)
    const id = setInterval(() => fetchProjects().then(setProjects), 3000)
    return () => clearInterval(id)
  }, [])

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">No projects registered</p>
          <p className="mt-1 text-sm">Run: <code className="bg-gray-200 px-2 py-0.5 rounded">ai-company init</code></p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">AI Company</h1>
      </header>
      <main className="max-w-4xl mx-auto p-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Projects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.name}
              to={`/${encodeURIComponent(p.name)}`}
              className={`block bg-white rounded-lg border p-4 hover:shadow-md transition-shadow ${
                p.status === 'offline' ? 'opacity-60 border-gray-200' : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  p.status === 'active' ? 'bg-status-free' : 'bg-gray-300'
                }`} />
                <span className="font-medium text-gray-900">{p.name}</span>
              </div>
              {p.status === 'offline' && (
                <span className="mt-2 inline-block text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                  Offline
                </span>
              )}
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
