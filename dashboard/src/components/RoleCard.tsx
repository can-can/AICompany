import { Link } from 'react-router-dom'
import type { RoleStatus } from '../lib/api'

const stateConfig: Record<string, { border: string; color: string; label: string }> = {
  free: { border: 'border-status-free', color: 'text-status-free', label: 'free' },
  working: { border: 'border-status-working', color: 'text-status-working', label: 'working' },
  waiting_human: { border: 'border-status-waiting', color: 'text-status-waiting', label: 'waiting' },
  ready: { border: 'border-status-free', color: 'text-status-free', label: 'ready' },
}

export default function RoleCard({
  name,
  role,
  project,
}: {
  name: string
  role: RoleStatus
  project: string
}) {
  const config = stateConfig[role.state] ?? stateConfig.free

  return (
    <Link
      to={`/${encodeURIComponent(project)}/chat/${encodeURIComponent(name)}`}
      className={`block bg-white rounded-lg border-t-[3px] ${config.border} border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer`}
    >
      <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">{name}</div>
      <div className={`text-sm font-semibold mt-1 ${config.color}`}>
        {role.state === 'waiting_human' && <span className="inline-block w-2 h-2 bg-status-waiting rounded-full mr-1.5 animate-pulse" />}
        {config.label}
      </div>
      <div className="text-xs text-gray-500 mt-2">
        {role.activeTask ? `#${role.activeTask.id} ${role.activeTask.title}` : 'No active task'}
      </div>
      <div className="text-xs text-gray-400 mt-0.5">queue: {role.queueDepth}</div>
    </Link>
  )
}
