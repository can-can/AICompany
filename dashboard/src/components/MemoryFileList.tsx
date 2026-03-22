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
    `shrink-0 text-left px-3 py-1.5 text-sm rounded cursor-pointer truncate ${
      path === activePath
        ? 'bg-blue-50 text-blue-700 font-medium'
        : 'text-gray-700 hover:bg-gray-100'
    }`

  return (
    <nav className="shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-white overflow-x-auto md:overflow-x-visible md:overflow-y-auto md:w-52 flex md:flex-col items-start gap-1 p-2 md:p-3">
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
          <div key={role} className="flex md:flex-col gap-1 md:mt-2 shrink-0">
            <div className="hidden md:block px-3 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
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
                  <span className="md:hidden text-gray-400 mr-1">{role}/</span>
                  {filename}
                </button>
              )
            })}
          </div>
        ))}
    </nav>
  )
}
