import { Link, useParams } from 'react-router-dom'
import type { ProjectStatus } from '../lib/api'

const stateColor: Record<string, string> = {
  free: 'bg-green-100 text-green-800',
  working: 'bg-amber-100 text-amber-800',
  waiting_human: 'bg-red-100 text-red-800',
  ready: 'bg-green-100 text-green-800',
}

export default function RoleSidebar({ status }: { status: ProjectStatus | null }) {
  const { project, role: activeRole } = useParams<{ project: string; role: string }>()

  if (!status) return null

  return (
    <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-3">
      {Object.entries(status.roles).map(([name]) => {
        const isActive = name === activeRole
        return (
          <Link
            key={name}
            to={`/${encodeURIComponent(project!)}/chat/${encodeURIComponent(name)}`}
            title={name}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold uppercase transition-all ${
              isActive
                ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400'
                : `${stateColor[status.roles[name].state] ?? stateColor.free} hover:ring-2 hover:ring-gray-300`
            }`}
          >
            {name.slice(0, 3)}
          </Link>
        )
      })}
    </div>
  )
}
