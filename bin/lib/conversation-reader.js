/**
 * Extract text content from an SDK SessionMessage into a simple chat entry.
 * Returns null if the message has no text content blocks.
 *
 * Note: SessionMessage.message is typed as `unknown` in the SDK.
 * At runtime it follows the Anthropic API message format:
 * { role, content: string | Array<{type: 'text', text} | {type: 'tool_use', ...}> }
 */
function toEntry(msg) {
  const rawContent = msg.message?.content

  // Build structured content parts array
  const parts = []

  if (typeof rawContent === 'string') {
    if (rawContent.trim()) {
      parts.push({ type: 'text', text: rawContent.trim() })
    }
  } else if (Array.isArray(rawContent)) {
    for (const block of rawContent) {
      if (block.type === 'text' && block.text?.trim()) {
        parts.push({ type: 'text', text: block.text })
      } else if (block.type === 'tool_use') {
        parts.push({
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input,
        })
      } else if (block.type === 'tool_result') {
        parts.push({
          type: 'tool_result',
          tool_use_id: block.tool_use_id,
          content: block.content,
        })
      }
    }
  }

  if (parts.length === 0) return null

  // Derive plain text for backward compatibility
  const text = parts
    .filter(p => p.type === 'text')
    .map(p => p.text)
    .join('\n\n')

  return {
    role: msg.type, // 'user' | 'assistant'
    id: msg.uuid,
    text,
    content: parts,
  }
}

/**
 * Convert an array of SDK SessionMessages to simple chat entries,
 * filtering out tool-only messages.
 */
export function extractMessages(sdkMessages) {
  return sdkMessages.map(toEntry).filter(Boolean)
}

/**
 * Create a conversation reader with an injected SDK function.
 * Uses dependency injection so tests can provide a mock getSessionMessages.
 *
 * @param {Function} getSessionMessages - SDK's getSessionMessages function
 * @returns {{ readPage: Function }}
 */
export function createConversationReader(getSessionMessages) {
  /**
   * Read a page of conversation history, newest messages first.
   *
   * The SDK returns messages in chronological order (oldest first).
   * We need newest-first for the "load older on scroll up" pattern.
   *
   * Strategy: Read ALL messages from the SDK (local JSONL files, fast),
   * filter to text-only, then slice for the requested page.
   *
   * @param {string} sessionId
   * @param {object} [options]
   * @param {number} [options.limit=10] - Messages per page
   * @param {string} [options.before] - Message UUID cursor - return messages before this one
   * @returns {Promise<{messages: Array, hasMore: boolean}>}
   */
  async function readPage(sessionId, { limit = 10, before } = {}) {
    const allSdk = await getSessionMessages(sessionId)
    const allMessages = extractMessages(allSdk)

    // Messages are chronological. Slice from the end for newest-first pages.
    let endIndex = allMessages.length
    if (before) {
      const cursorIdx = allMessages.findIndex(m => m.id === before)
      if (cursorIdx !== -1) endIndex = cursorIdx
    }

    const startIndex = Math.max(0, endIndex - limit)
    const page = allMessages.slice(startIndex, endIndex)

    return {
      messages: page,
      hasMore: startIndex > 0,
    }
  }

  return { readPage }
}
