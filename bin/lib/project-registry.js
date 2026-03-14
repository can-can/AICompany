import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'

// Path helpers read process.env.AI_COMPANY_HOME at CALL TIME, not module load time.
// Tests can set the env var in beforeEach and get isolation without any cache-busting tricks.
function getRegistryDir() { return process.env.AI_COMPANY_HOME ?? join(homedir(), '.ai-company') }
function getRegistryPath() { return join(getRegistryDir(), 'projects.json') }
function getPidPath() { return join(getRegistryDir(), '.server-pid') }

function readRegistry() {
  const registryPath = getRegistryPath()
  if (!existsSync(registryPath)) return []
  try {
    return JSON.parse(readFileSync(registryPath, 'utf8'))
  } catch {
    return []
  }
}

function writeRegistry(projects) {
  mkdirSync(getRegistryDir(), { recursive: true })
  writeFileSync(getRegistryPath(), JSON.stringify(projects, null, 2))
}

function addProject(name, projectPath) {
  const abs = resolve(projectPath)
  const projects = readRegistry().filter(p => p.name !== name && p.path !== abs)
  projects.push({ name, path: abs })
  writeRegistry(projects)
}

function removeProject(nameOrPath) {
  const abs = resolve(nameOrPath)
  const filtered = readRegistry().filter(p => p.name !== nameOrPath && p.path !== abs)
  writeRegistry(filtered)
}

// Walk up from cwd, return first matching registered project or null
function resolveProject(cwd) {
  const projects = readRegistry()
  let dir = resolve(cwd)
  while (true) {
    const match = projects.find(p => p.path === dir)
    if (match) return match
    const parent = join(dir, '..')
    if (parent === dir) return null
    dir = parent
  }
}

export { readRegistry, writeRegistry, addProject, removeProject, resolveProject, getRegistryDir, getRegistryPath, getPidPath }
