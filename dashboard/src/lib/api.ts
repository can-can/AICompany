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
