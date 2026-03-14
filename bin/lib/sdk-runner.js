import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

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
  async function runAgent(task, role, sessionId) {
    // Dynamic import to avoid top-level SDK load errors if not configured
    const { query } = await import('@anthropic-ai/claude-agent-sdk')

    const options = {
      cwd: join(projectDir, 'roles', role),
      permissionMode: 'bypassPermissions'
    }
    if (sessionId) options.resume = sessionId

    const prompt = buildPrompt(task, role, projectDir)
    let lastSessionId = sessionId
    let resultStatus = 'unknown'

    for await (const message of query({ prompt, options })) {
      if (message.type === 'result') {
        lastSessionId = message.session_id ?? lastSessionId
        resultStatus = message.subtype ?? 'done'
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

    return { sessionId: lastSessionId, resultStatus }
  }

  return runAgent
}
