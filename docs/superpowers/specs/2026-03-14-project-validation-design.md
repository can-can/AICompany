# Project Structure Validation — Design Spec

## Problem

Projects registered with `ai-company` may have incomplete or broken structure — missing `company.md`, role directories without `CLAUDE.md`, no `tasks/` directory. There is no validation at registration time, server activation, or on demand. Users discover problems only when agents fail at runtime.

## Solution

Add a `validateProject()` function that checks project structure, reports issues, and offers auto-fixes for recoverable problems. Wire it into three integration points: a new CLI command, the register flow, and server activation.

## Core: `validateProject(projectPath, packageRoot)`

**File:** `bin/lib/project-validator.js`

**Signature:**
```javascript
export function validateProject(projectPath, packageRoot)
```

**Parameters:**
- `projectPath` — absolute path to the project directory
- `packageRoot` — absolute path to the ai-company package root (for finding templates). Callers derive this from `join(__dirname, '..')` in CLI or `join(dirname(fileURLToPath(import.meta.url)), '../..')` in lib files.

**Returns:**
```javascript
{
  valid: boolean,       // true only if errors is empty
  errors: string[],     // human-readable issue descriptions (both fixable and unfixable)
  fixes: Fix[]          // subset of errors that can be auto-fixed
}
```

Where `Fix` is:
```javascript
{ description: string, apply: () => void }
```

`apply()` may throw on filesystem errors — callers should catch and report.

**Behavior:** All checks run unconditionally and all errors are collected (no short-circuit). Fixes are returned but never applied by `validateProject` itself — the caller decides. After applying fixes, the caller can re-run `validateProject` to confirm the project is now valid.

**Template fallbacks:** For `CLAUDE.md` and `memory.md`, if no matching template exists in the package (e.g. custom role name), the fix creates a generic file (`# {role}\n\nYou are the {role}. Complete tasks assigned to you.\n` for CLAUDE.md, `# {role} Memory\n\n## Handoff Notes\n\n` for memory.md). For `company.md`, the fix always copies from `templates/company.md` (guaranteed to exist in the package).

**Checks (in order, all run regardless of earlier failures):**

| # | Check | Error message | Auto-fix |
|---|-------|--------------|----------|
| 1 | `company.md` exists | "Missing company.md" | Copy from `templates/company.md` with placeholder name/goal/workflow |
| 2 | `roles/` directory exists | "Missing roles/ directory" | Create directory |
| 3 | At least one role subdirectory in `roles/` | "No role directories found in roles/" | None (user must decide roles) |
| 4 | Each role subdir has `CLAUDE.md` | "roles/{role} missing CLAUDE.md" | Scaffold from `roles/{role}.md` template if it exists, else generic |
| 5 | Each role subdir has `memory.md` | "roles/{role} missing memory.md" | Scaffold from `memories/{role}.md` template if it exists, else generic |
| 6 | `tasks/` directory exists | "Missing tasks/ directory" | Create directory |

The function performs no I/O prompting — it only reads the filesystem and returns a result. The caller decides how to present issues and whether to apply fixes.

## Integration Points

### 1. `ai-company validate [--project <name>] [--all]`

New CLI command. Behavior:

- Resolve target project(s): `--all` validates every registered project, `--project <name>` targets one, otherwise resolves from cwd.
- Run `validateProject` on each.
- If all valid: print "Project structure OK" and exit 0.
- If issues found with fixes: list all issues, prompt "Fix all? [Y/n]" (Enter defaults to Y), apply on confirmation, then re-validate.
- With `--all`: validate every project, report results per-project, prompt once per project that has fixes.
- If unfixable issues remain after fixes: exit 1.
- If no fixes available: list issues and exit 1.

### 2. `ai-company register` (existing command, modified)

After adding the project to the registry (current behavior unchanged):

- Run `validateProject`.
- If issues found with fixes: list them, prompt "Fix all? [Y/n]", apply on confirmation.
- Registration succeeds regardless — validation is advisory.

### 3. Server activation (`company-server.js` `activateProject`)

Non-interactive context — auto-fix silently:

- Run `validateProject` at the top of `activateProject`, before `loadRoles`/roleManager/watcher creation.
- Apply all available fixes automatically (wrap each `fix.apply()` in try/catch, log failures).
- Log warnings for unfixable issues (e.g. "No role directories found").
- Still activate the project (best-effort) — validation failures do not block activation.

### 4. `ai-company init`

No changes. `init` already creates the full valid structure.

## Files Changed

| File | Change |
|------|--------|
| `bin/lib/project-validator.js` | **CREATE** — `validateProject()` function |
| `bin/ai-company.js` | Add `validate` command, hook validation into `cmdRegister` |
| `bin/company-server.js` | Call `validateProject` + auto-apply fixes in `activateProject` |
| `test/project-validator.test.js` | **CREATE** — unit tests for all checks and fixes |

## Testing

Unit tests for `validateProject`:

- Complete valid project returns `{ valid: true, errors: [], fixes: [] }`
- Missing `company.md` returns fixable error; applying fix creates file from template
- Missing `roles/` returns fixable error; applying fix creates directory
- Empty `roles/` (no subdirs) returns unfixable error
- Role subdir missing `CLAUDE.md` returns fixable error; fix scaffolds from template
- Role subdir missing `memory.md` returns fixable error; fix scaffolds from template
- Missing `tasks/` returns fixable error; applying fix creates directory
- Multiple issues detected in single run

## Not in Scope

- Consistency checks (orphaned task references, stale sessions) — future work
- Schema validation of `company.md` content
- Validation of task file format
