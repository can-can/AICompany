import type { LogEntry } from '../lib/api'

const levelColor: Record<string, string> = {
  error: 'text-red-600',
  warn: 'text-amber-600',
  info: '',
}

export default function LogFeed({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-56 overflow-y-auto font-mono text-xs">
      {logs.map((l, i) => (
        <div key={i} className="leading-relaxed">
          <span className="text-status-free mr-2">{l.timestamp?.slice(11, 19)}</span>
          {l.role && <span className="text-status-active font-medium mr-2">{l.role}</span>}
          <span className={levelColor[l.level] ?? ''}>{l.message}</span>
        </div>
      ))}
    </div>
  )
}
