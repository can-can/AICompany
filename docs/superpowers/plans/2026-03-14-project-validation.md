# Project Structure Validation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `validateProject()` function that checks project structure and offers auto-fixes, wired into the CLI (`validate` command + `register`) and server activation.

**Architecture:** A pure `validateProject(projectPath, packageRoot)` function returns errors and fix closures. Three callers: CLI `validate` (interactive prompt), CLI `register` (interactive prompt), server `activateProject` (silent auto-fix). The function never applies fixes itself.

**Tech Stack:** Node.js ESM, `node:test`, `node:fs`, `node:readline/promises`

**Spec:** `docs/superpowers/specs/2026-03-14-project-validation-design.md`

---

## Task 1: Create `validateProject` with Tests

**Files:**
- Create: `bin/lib/project-validator.js`
- Create: `test/project-validator.test.js`

- [ ] **Step 1: Write tests for `validateProject`**

Create `test/project-validator.test.js`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { validateProject } from '../bin/lib/project-validator.js'

// packageRoot is the ai-company package root (has templates/, roles/*.md, memories/*.md)
const packageRoot = join(import.meta.dirname, '..')

function makeTmpDir(suffix) {
  const dir = join(tmpdir(), `validate-test-${Date.now()}-${suffix}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

test('valid project returns no errors', (t) => {
  const dir = makeTmpDir('valid')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  // Create valid structure
  writeFileSync(join(dir, 'company.md'), '# Company')
  mkdirSync(join(dir, 'roles', 'engineer'), { recursive: true })
  writeFileSync(join(dir, 'roles', 'engineer', 'CLAUDE.md'), '# Engineer')
  writeFileSync(join(dir, 'roles', 'engineer', 'memory.md'), '# Memory')
  mkdirSync(join(dir, 'tasks'), { recursive: true })

  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, true)
  assert.equal(result.errors.length, 0)
  assert.equal(result.fixes.length, 0)
})

test('missing company.md is fixable', (t) => {
  const dir = makeTmpDir('no-company')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  mkdirSync(join(dir, 'roles', 'pm'), { recursive: true })
  writeFileSync(join(dir, 'roles', 'pm', 'CLAUDE.md'), '# PM')
  writeFileSync(join(dir, 'roles', 'pm', 'memory.md'), '# Mem')
  mkdirSync(join(dir, 'tasks'))

  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.includes('company.md')))
  assert.ok(result.fixes.some(f => f.description.includes('company.md')))

  // Apply fix
  result.fixes.forEach(f => f.apply())
  assert.ok(existsSync(join(dir, 'company.md')))
})

test('missing roles/ directory is fixable', (t) => {
  const dir = makeTmpDir('no-roles')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, 'company.md'), '# Company')
  mkdirSync(join(dir, 'tasks'))

  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.includes('roles/')))
  assert.ok(result.fixes.some(f => f.description.includes('roles/')))
})

test('empty roles/ directory is unfixable', (t) => {
  const dir = makeTmpDir('empty-roles')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, 'company.md'), '# Company')
  mkdirSync(join(dir, 'roles'))
  mkdirSync(join(dir, 'tasks'))

  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.includes('No role directories')))
  // This error has no corresponding fix
  const fixDescriptions = result.fixes.map(f => f.description)
  assert.ok(!fixDescriptions.some(d => d.includes('No role directories')))
})

test('role missing CLAUDE.md is fixable with template', (t) => {
  const dir = makeTmpDir('no-claudemd')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, 'company.md'), '# Company')
  mkdirSync(join(dir, 'roles', 'engineer'), { recursive: true })
  writeFileSync(join(dir, 'roles', 'engineer', 'memory.md'), '# Mem')
  mkdirSync(join(dir, 'tasks'))

  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.includes('engineer') && e.includes('CLAUDE.md')))

  result.fixes.forEach(f => f.apply())
  assert.ok(existsSync(join(dir, 'roles', 'engineer', 'CLAUDE.md')))
})

test('role missing memory.md is fixable with template', (t) => {
  const dir = makeTmpDir('no-memorymd')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, 'company.md'), '# Company')
  mkdirSync(join(dir, 'roles', 'qa'), { recursive: true })
  writeFileSync(join(dir, 'roles', 'qa', 'CLAUDE.md'), '# QA')
  mkdirSync(join(dir, 'tasks'))

  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.includes('qa') && e.includes('memory.md')))

  result.fixes.forEach(f => f.apply())
  assert.ok(existsSync(join(dir, 'roles', 'qa', 'memory.md')))
})

test('missing tasks/ directory is fixable', (t) => {
  const dir = makeTmpDir('no-tasks')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, 'company.md'), '# Company')
  mkdirSync(join(dir, 'roles', 'pm'), { recursive: true })
  writeFileSync(join(dir, 'roles', 'pm', 'CLAUDE.md'), '# PM')
  writeFileSync(join(dir, 'roles', 'pm', 'memory.md'), '# Mem')

  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.includes('tasks/')))

  result.fixes.forEach(f => f.apply())
  assert.ok(existsSync(join(dir, 'tasks')))
})

test('multiple issues detected in single run', (t) => {
  const dir = makeTmpDir('multiple')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  // Completely empty dir — should get company.md, roles/, tasks/ errors
  const result = validateProject(dir, packageRoot)
  assert.equal(result.valid, false)
  assert.ok(result.errors.length >= 3)
})

test('custom role gets generic CLAUDE.md fallback', (t) => {
  const dir = makeTmpDir('custom-role')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(join(dir, 'company.md'), '# Company')
  mkdirSync(join(dir, 'roles', 'analyst'), { recursive: true })
  writeFileSync(join(dir, 'roles', 'analyst', 'memory.md'), '# Mem')
  mkdirSync(join(dir, 'tasks'))

  const result = validateProject(dir, packageRoot)
  result.fixes.forEach(f => f.apply())

  const content = readFileSync(join(dir, 'roles', 'analyst', 'CLAUDE.md'), 'utf8')
  assert.ok(content.includes('analyst'))
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/project-validator.test.js`
Expected: FAIL — module `../bin/lib/project-validator.js` not found

- [ ] **Step 3: Implement `validateProject`**

Create `bin/lib/project-validator.js`:

```javascript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/project-validator.test.js`
Expected: all 9 tests PASS

- [ ] **Step 5: Run full test suite**

Run: `node --test test/**/*.test.js`
Expected: all ~52 tests PASS (43 existing + 9 new)

- [ ] **Step 6: Commit**

```bash
git add bin/lib/project-validator.js test/project-validator.test.js
git commit -m "feat: add validateProject function with tests"
```

---

## Task 2: Add `ai-company validate` CLI Command

**Files:**
- Modify: `bin/ai-company.js` (add `cmdValidate`, add to command map and help text)

**Depends on:** Task 1

- [ ] **Step 1: Add `cmdValidate` function to `bin/ai-company.js`**

Add this function after `cmdUnregister` (around line 197), before the Task management section:

```javascript
async function cmdValidate(args, flags) {
  const { validateProject } = await import('./lib/project-validator.js')
  const packageRoot = join(__dirname, '..')

  let projects
  if (flags.all) {
    const { readRegistry } = await reg()
    projects = readRegistry()
    if (projects.length === 0) {
      console.log('No registered projects. Run: ai-company init')
      return
    }
  } else {
    const project = await requireProject(flags)
    projects = [project]
  }

  let hasUnfixable = false

  for (const project of projects) {
    if (projects.length > 1) console.log(`\n--- ${project.name} ---`)

    if (!existsSync(project.path)) {
      console.error(`  Project path not found: ${project.path}`)
      hasUnfixable = true
      continue
    }

    const result = validateProject(project.path, packageRoot)

    if (result.valid) {
      console.log(`  Project structure OK`)
      continue
    }

    console.log(`  Found ${result.errors.length} issue(s):`)
    for (const err of result.errors) console.log(`    - ${err}`)

    if (result.fixes.length > 0) {
      const { createInterface } = await import('node:readline/promises')
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      const answer = await rl.question(`\n  Fix ${result.fixes.length} issue(s)? [Y/n] `)
      rl.close()

      if (!answer || answer.toLowerCase().startsWith('y')) {
        for (const fix of result.fixes) {
          try {
            fix.apply()
            console.log(`    ✓ Fixed: ${fix.description}`)
          } catch (err) {
            console.error(`    ✗ Failed: ${fix.description} — ${err.message}`)
          }
        }

        // Re-validate
        const recheck = validateProject(project.path, packageRoot)
        if (recheck.valid) {
          console.log(`  Project structure OK after fixes`)
        } else {
          console.log(`  ${recheck.errors.length} unfixable issue(s) remain:`)
          for (const err of recheck.errors) console.log(`    - ${err}`)
          hasUnfixable = true
        }
      } else {
        hasUnfixable = true
      }
    } else {
      hasUnfixable = true
    }
  }

  if (hasUnfixable) process.exit(1)
}
```

- [ ] **Step 2: Add `validate` to the command map**

In the `commands` object (around line 435), add:

```javascript
  validate:   () => cmdValidate(args, flags),
```

- [ ] **Step 3: Update help text**

Update the usage string to include `validate`:

```
Hub:        start | stop | health
Projects:   init [dir] | register [dir] | unregister [dir] | list | validate [--all]
Tasks:      create <role> <title> | tasks [role] | send <role> "msg" | next-id | status
```

- [ ] **Step 4: Verify syntax**

Run: `node --check bin/ai-company.js`
Expected: no output (clean syntax)

- [ ] **Step 5: Run full test suite**

Run: `node --test test/**/*.test.js`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add bin/ai-company.js
git commit -m "feat: add ai-company validate CLI command"
```

---

## Task 3: Hook Validation into `cmdRegister`

**Files:**
- Modify: `bin/ai-company.js` (`cmdRegister` function, around line 167)

**Depends on:** Task 1

- [ ] **Step 1: Add validation to `cmdRegister`**

After the existing `console.log('If the hub is running...')` line at the end of `cmdRegister`, add:

```javascript
  // Validate project structure
  const { validateProject } = await import('./lib/project-validator.js')
  const packageRoot = join(__dirname, '..')
  const result = validateProject(dir, packageRoot)

  if (!result.valid) {
    console.log(`\nValidation found ${result.errors.length} issue(s):`)
    for (const err of result.errors) console.log(`  - ${err}`)

    if (result.fixes.length > 0) {
      const { createInterface } = await import('node:readline/promises')
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      const answer = await rl.question(`\nFix ${result.fixes.length} issue(s)? [Y/n] `)
      rl.close()

      if (!answer || answer.toLowerCase().startsWith('y')) {
        for (const fix of result.fixes) {
          try {
            fix.apply()
            console.log(`  ✓ Fixed: ${fix.description}`)
          } catch (err) {
            console.error(`  ✗ Failed: ${fix.description} — ${err.message}`)
          }
        }
      }
    }
  }
```

- [ ] **Step 2: Verify syntax**

Run: `node --check bin/ai-company.js`
Expected: no output

- [ ] **Step 3: Run full test suite**

Run: `node --test test/**/*.test.js`
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add bin/ai-company.js
git commit -m "feat: validate project structure on register"
```

---

## Task 4: Hook Validation into Server Activation

**Files:**
- Modify: `bin/company-server.js` (add import, call in `activateProject` around line 25)

**Depends on:** Task 1

- [ ] **Step 1: Add import to `company-server.js`**

Add at the top, after the other imports (line 12):

```javascript
import { validateProject } from './lib/project-validator.js'
```

- [ ] **Step 2: Add validation call at the top of `activateProject`**

Inside the `try` block of `activateProject`, right after `const roles = loadRoles(path)` is currently line 33. Insert validation **before** `loadRoles`. Replace lines 32-33:

```javascript
  try {
    // Validate and auto-fix project structure before loading
    const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
    const validation = validateProject(path, packageRoot)
    if (!validation.valid) {
      for (const fix of validation.fixes) {
        try {
          fix.apply()
          console.log(`[hub] Auto-fixed '${name}': ${fix.description}`)
        } catch (fixErr) {
          console.warn(`[hub] Fix failed for '${name}': ${fix.description} — ${fixErr.message}`)
        }
      }
      // Re-check for unfixable issues
      const recheck = validateProject(path, packageRoot)
      for (const err of recheck.errors) {
        console.warn(`[hub] Validation warning for '${name}': ${err}`)
      }
    }

    const roles = loadRoles(path)
```

- [ ] **Step 3: Verify syntax**

Run: `node --check bin/company-server.js`
Expected: no output

- [ ] **Step 4: Run full test suite**

Run: `node --test test/**/*.test.js`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add bin/company-server.js
git commit -m "feat: auto-fix project structure on server activation"
```

---

## Task 5: Final Verification + Global Install

**Depends on:** Tasks 1-4

- [ ] **Step 1: Run full test suite**

Run: `node --test test/**/*.test.js`
Expected: all ~52 tests pass

- [ ] **Step 2: Syntax check both entry points**

Run: `node --check bin/ai-company.js && node --check bin/company-server.js`
Expected: no output

- [ ] **Step 3: Verify npm pack is still clean**

Run: `npm pack --dry-run`
Expected: `bin/lib/project-validator.js` included, no test files, no live state

- [ ] **Step 4: Reinstall globally**

Run: `npm install -g .`
Expected: success

- [ ] **Step 5: Smoke test**

Run: `ai-company validate --help` (should show usage since no project)
Run: `ai-company validate` from inside the AICompany project (should show "Project structure OK" or list issues)
