export function createLogger(capacity = 500) {
  const buffer = []

  function add(level, role, message) {
    buffer.push({ timestamp: new Date().toISOString(), level, role: role ?? null, message })
    if (buffer.length > capacity) buffer.shift()
  }

  function get(n = 50) {
    return buffer.slice(-n)
  }

  return { add, get }
}
