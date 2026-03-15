import { existsSync, readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function validateProject(projectPath, packageRoot) {
  const errors = []
  const fixes = []

  // Check 1: company.md
  if (!existsSync(join(projectPath, 'company.md'))) {
    const desc = 'Missing company.md'
    errors.push(desc)
    fixes.push({
      description: desc,
      apply: () => {
        const template = readFileSync(join(packageRoot, 'templates', 'company.md'), 'utf8')
        const content = template
          .replaceAll('{{name}}', 'My Project')
          .replaceAll('{{goal}}', 'An AI company project')
          .replaceAll('{{workflow}}', 'human → pm → engineer → qa')
        writeFileSync(join(projectPath, 'company.md'), content)
      }
    })
  }

  // Check 2: roles/ directory
  const rolesDir = join(projectPath, 'roles')
  if (!existsSync(rolesDir)) {
    const desc = 'Missing roles/ directory'
    errors.push(desc)
    fixes.push({ description: desc, apply: () => mkdirSync(rolesDir, { recursive: true }) })
  }

  // Check 3: at least one role subdirectory
  let roles = []
  if (existsSync(rolesDir)) {
    try {
      roles = readdirSync(rolesDir)
        .filter(name => !name.startsWith('.') && statSync(join(rolesDir, name)).isDirectory())
    } catch {}
  }
  if (existsSync(rolesDir) && roles.length === 0) {
    errors.push('No role directories found in roles/')
  }

  // Check 4 & 5: each role has CLAUDE.md and memory.md
  for (const role of roles) {
    const roleDir = join(rolesDir, role)

    if (!existsSync(join(roleDir, 'CLAUDE.md'))) {
      const desc = `roles/${role} missing CLAUDE.md`
      errors.push(desc)
      fixes.push({
        description: desc,
        apply: () => {
          const template = join(packageRoot, 'roles', `${role}.md`)
          if (existsSync(template)) {
            copyFileSync(template, join(roleDir, 'CLAUDE.md'))
          } else {
            writeFileSync(join(roleDir, 'CLAUDE.md'), `# ${role}\n\nYou are the ${role}. Complete tasks assigned to you.\n`)
          }
        }
      })
    }

    if (!existsSync(join(roleDir, 'memory.md'))) {
      const desc = `roles/${role} missing memory.md`
      errors.push(desc)
      fixes.push({
        description: desc,
        apply: () => {
          const template = join(packageRoot, 'memories', `${role}.md`)
          if (existsSync(template)) {
            copyFileSync(template, join(roleDir, 'memory.md'))
          } else {
            writeFileSync(join(roleDir, 'memory.md'), `# ${role} Memory\n\n## Handoff Notes\n\n`)
          }
        }
      })
    }
  }

  // Check 6: tasks/ directory
  if (!existsSync(join(projectPath, 'tasks'))) {
    const desc = 'Missing tasks/ directory'
    errors.push(desc)
    fixes.push({ description: desc, apply: () => mkdirSync(join(projectPath, 'tasks'), { recursive: true }) })
  }

  return { valid: errors.length === 0, errors, fixes }
}
