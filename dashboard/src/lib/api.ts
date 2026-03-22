export type Project = {
  name: string
  path: string
  status: 'active' | 'offline'
}

export type RoleStatus = {
  state: 'free' | 'working' | 'waiting_human' | 'ready'
  activeTask: { id: string; title: string } | null
  queueDepth: number
  lastMessages: string[]
}

export type ProjectStatus = {
  project: string
  roles: Record<string, RoleStatus>
}

export type TaskItem = {
  id: string
  title: string
  from: string
  to: string
  owner: string
  status: string
  priority: string
  created: string
  updated: string
}

export type TaskDetail = TaskItem & {
  parent: string | null
  body: string
  created: string
  updated: string
}

export type LogEntry = {
  timestamp: string
  level: string
  role: string | null
  message: string
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects')
  return res.json()
}

export async function fetchStatus(project: string): Promise<ProjectStatus | null> {
  const res = await fetch(`/api/status?project=${encodeURIComponent(project)}`)
  if (res.status === 503) return null
  return res.json()
}

export async function fetchTasks(project: string): Promise<TaskItem[]> {
  const res = await fetch(`/api/tasks?project=${encodeURIComponent(project)}`)
  if (!res.ok) return []
  return res.json()
}

export async function fetchLogs(project: string, limit = 50): Promise<LogEntry[]> {
  const res = await fetch(`/api/logs?project=${encodeURIComponent(project)}&limit=${limit}`)
  if (!res.ok) return []
  return res.json()
}

export async function sendMessage(project: string, role: string, message: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/send?project=${encodeURIComponent(project)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, message }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to send')
  return data
}

export async function stopAgent(project: string, role: string): Promise<{ ok: boolean; stopped: boolean }> {
  const res = await fetch(`/api/stop?project=${encodeURIComponent(project)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to stop agent')
  return data
}

export async function fetchTask(project: string, id: string): Promise<TaskDetail | null> {
  const res = await fetch(`/api/task?project=${encodeURIComponent(project)}&id=${encodeURIComponent(id)}`)
  if (!res.ok) return null
  return res.json()
}

export async function clearConversation(project: string, role: string): Promise<{ ok: boolean; cleared: boolean }> {
  const res = await fetch(`/api/conversation?project=${encodeURIComponent(project)}&role=${encodeURIComponent(role)}`, {
    method: 'DELETE',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to clear conversation')
  return data
}

export type MemoryFile = {
  path: string
  content: string
}

export async function fetchMemoryFiles(project: string): Promise<MemoryFile[]> {
  const res = await fetch(`/api/memory?project=${encodeURIComponent(project)}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.files
}

export async function saveMemoryFile(project: string, path: string, content: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/memory?project=${encodeURIComponent(project)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to save')
  return data
}

export async function updateTaskStatus(project: string, id: string, status: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/task/status?project=${encodeURIComponent(project)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to update status')
  return data
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: unknown }

export type ConversationMessage = {
  role: 'user' | 'assistant'
  id: string
  text: string
  content?: ContentPart[]
}

export type ConversationPage = {
  messages: ConversationMessage[]
  hasMore: boolean
}

export async function fetchConversation(
  project: string,
  role: string,
  limit = 30,
  before?: string,
): Promise<ConversationPage> {
  const params = new URLSearchParams({ project, role, limit: String(limit) })
  if (before) params.set('before', before)
  const res = await fetch(`/api/conversation?${params}`)
  if (!res.ok) return { messages: [], hasMore: false }
  return res.json()
}
