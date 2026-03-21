import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function extractContentParts(rawContent) {
  if (!Array.isArray(rawContent)) {
    return [{ type: 'text', text: String(rawContent) }]
  }
  const parts = []
  for (const block of rawContent) {
    if (block.type === 'text' && block.text?.trim()) {
      parts.push({ type: 'text', text: block.text })
    } else if (block.type === 'tool_use') {
      parts.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input })
    } else if (block.type === 'tool_result') {
      parts.push({ type: 'tool_result', tool_use_id: block.tool_use_id, content: block.content })
    }
  }
  return parts
}

export function buildPrompt(task, role, projectDir) {
  const taskContent = readFileSync(task.filepath, 'utf8')
  const claudeMdPath = join(projectDir, 'roles', role, 'CLAUDE.md')
  const companyMdPath = join(projectDir, 'company.md')

  const claudeMd = existsSync(claudeMdPath) ? readFileSync(claudeMdPath, 'utf8') : ''
  const companyMd = existsSync(companyMdPath) ? readFileSync(companyMdPath, 'utf8') : ''

  return [
    `# Your Role\n${claudeMd}`,
    `# Company Context\n${companyMd}`,
    `# Your Task\n${taskContent}`,
    `You are the ${role}. Complete the task above. When done, update the task file status to "done" (or "rejected" with a reason). Update your memory.md with any handoff notes.`
  ].join('\n\n---\n\n')
}

export function createSdkRunner(projectDir, sessionsPath) {
  async function runAgent(task, role, sessionId, { prompt: overridePrompt, onMessage } = {}) {
    // Dynamic import to avoid top-level SDK load errors if not configured
    const { query } = await import('@anthropic-ai/claude-agent-sdk')

    const options = {
      cwd: join(projectDir, 'roles', role),
      // Override with AI_COMPANY_PERMISSION_MODE env var (e.g. 'default', 'acceptEdits')
      permissionMode: process.env.AI_COMPANY_PERMISSION_MODE ?? 'bypassPermissions'
    }
    if (sessionId) options.resume = sessionId

    const prompt = overridePrompt ?? buildPrompt(task, role, projectDir)
    let lastSessionId = sessionId
    let resultStatus = 'unknown'
    const messages = []

    for await (const event of query({ prompt, options })) {
      if (event.type === 'result') {
        lastSessionId = event.session_id ?? lastSessionId
        resultStatus = event.subtype ?? 'done'
      } else if (event.type === 'assistant') {
        // SDK wraps content in event.message.content
        const rawContent = event.message?.content ?? event.content
        if (rawContent) {
          const parts = extractContentParts(rawContent)
          const text = parts.filter(p => p.type === 'text').map(p => p.text).join('')
          if (text || parts.some(p => p.type === 'tool_use')) {
            messages.push(text)
            onMessage?.({ type: 'assistant', text, content: parts, sessionId: lastSessionId })
          }
        }
      } else if (event.type === 'user') {
        const rawContent = event.message?.content ?? event.content
        if (rawContent) {
          const text = Array.isArray(rawContent)
            ? rawContent.filter(b => b.type === 'text').map(b => b.text).join('')
            : String(rawContent)
          if (text) {
            onMessage?.({ type: 'user', text, sessionId: lastSessionId })
          }
        }
      }
    }

    // Persist updated session id
    if (lastSessionId && lastSessionId !== sessionId) {
      let sessions = {}
      if (existsSync(sessionsPath)) {
        try { sessions = JSON.parse(readFileSync(sessionsPath, 'utf8')) } catch {}
      }
      sessions[role] = lastSessionId
      writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2))
    }

    return { sessionId: lastSessionId, resultStatus, messages }
  }

  return runAgent
}
