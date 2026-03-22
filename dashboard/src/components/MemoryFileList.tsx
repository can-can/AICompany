import type { MemoryFile } from '../lib/api'

type GroupedFiles = {
  company: MemoryFile | null
  roles: Record<string, MemoryFile[]>
}

function groupFiles(files: MemoryFile[]): GroupedFiles {
  const result: GroupedFiles = { company: null, roles: {} }
  for (const f of files) {
    if (f.path === 'company.md') {
      result.company = f
    } else {
      const match = f.path.match(/^roles\/([^/]+)\//)
      if (match) {
        const role = match[1]
        if (!result.roles[role]) result.roles[role] = []
        result.roles[role].push(f)
      }
    }
  }
  return result
}

export default function MemoryFileList({
  files,
  activePath,
  onSelect,
}: {
  files: MemoryFile[]
  activePath: string | null
  onSelect: (path: string) => void
}) {
  const grouped = groupFiles(files)

  const itemClass = (path: string) =>
    `block w-full text-left px-3 py-1.5 text-sm rounded cursor-pointer truncate ${
      path === activePath
        ? 'bg-blue-50 text-blue-700 font-medium'
        : 'text-gray-700 hover:bg-gray-100'
    }`

  return (
    <nav className="w-52 shrink-0 border-r border-gray-200 bg-white p-3 overflow-y-auto">
      {grouped.company && (
        <button
          className={itemClass('company.md')}
          onClick={() => onSelect('company.md')}
        >
          company.md
        </button>
      )}

      {Object.entries(grouped.roles)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([role, roleFiles]) => (
          <div key={role} className="mt-3">
            <div className="px-3 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
              {role}
            </div>
            {roleFiles.map((f) => {
              const filename = f.path.split('/').pop()!
              return (
                <button
                  key={f.path}
                  className={itemClass(f.path)}
                  onClick={() => onSelect(f.path)}
                >
                  {filename}
                </button>
              )
            })}
          </div>
        ))}
    </nav>
  )
}
