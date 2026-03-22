# Memory Management UI

## Overview

Add a dedicated Memory page to the dashboard where users can view and edit agent memory files (`company.md`, `roles/<role>/CLAUDE.md`, `roles/<role>/memory.md`). Edits save immediately to disk so agents pick up changes on their next run.

## Navigation

- New route: `/:project/memory`
- Accessible from the project dashboard via a "Memory" link in the header (alongside the "All Projects / project-name" breadcrumb)
- Also accessible from the chat view header

## Layout

```
┌─────────────────────────────────────────────────────┐
│  All Projects / test-company / Memory    ← header   │
├──────────────┬──────────────────────────────────────┤
│  File List   │  Editor                               │
│  (200px)     │                                       │
│              │  ┌──────────────────────────────────┐ │
│ company.md   │  │ [Edit]  [Preview]        [Save]  │ │
│              │  ├──────────────────────────────────┤ │
│ ▾ pm         │  │                                  │ │
│   CLAUDE.md  │  │  (markdown editor or rendered    │ │
│   memory.md  │  │   preview depending on mode)     │ │
│              │  │                                  │ │
│ ▾ engineer   │  │                                  │ │
│   CLAUDE.md  │  │                                  │ │
│   memory.md  │  │                                  │ │
│              │  └──────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────┘
```

## File Sidebar

- Lists `company.md` at the top (project-level shared context)
- Then role folders, each with `CLAUDE.md` and `memory.md`
- Role folders always expanded (no collapse toggle — few files)
- Active file highlighted with blue background
- Click to switch files
- If switching with unsaved changes, show a confirm dialog

## Editor Area

### Two modes via toggle tabs

- **Edit**: monospace textarea, full height of the panel
- **Preview**: rendered markdown using the existing `MarkdownText` component
- Defaults to **Preview** mode when opening a file

### Save button

- Disabled when content matches the saved version (no changes)
- Enabled and blue when there are unsaved changes
- Saves immediately via `PUT /api/memory` — no draft/review flow
- Shows brief "Saved" confirmation after successful save

## API Endpoints

### `GET /api/memory?project=X`

Returns all memory files for the project.

```json
{
  "files": [
    { "path": "company.md", "content": "# Company Memory\n..." },
    { "path": "roles/pm/CLAUDE.md", "content": "# Role: PM\n..." },
    { "path": "roles/pm/memory.md", "content": "# PM Memory\n..." },
    { "path": "roles/engineer/CLAUDE.md", "content": "..." },
    { "path": "roles/engineer/memory.md", "content": "..." }
  ]
}
```

Implementation: reads `company.md` from project root, then scans `roles/*/` for `CLAUDE.md` and `memory.md`. Only returns files that exist.

### `PUT /api/memory?project=X`

Writes a single memory file.

```json
{ "path": "roles/pm/memory.md", "content": "# PM Memory\n\nUpdated content..." }
```

Returns `{ "ok": true }`. Path is validated to only allow known memory file patterns (`company.md`, `roles/<role>/CLAUDE.md`, `roles/<role>/memory.md`).

## Frontend Components

### `MemoryView.tsx` (view)

- Route: `/:project/memory`
- Fetches all memory files on mount via `GET /api/memory`
- Manages selected file state and dirty tracking
- Header with breadcrumb: All Projects / project-name / Memory

### `MemoryFileList.tsx` (component)

- Renders the file sidebar
- Groups files by role with `company.md` at top
- Highlights active file
- Calls `onSelect(path)` when clicked

### `MemoryEditor.tsx` (component)

- Props: `content`, `savedContent`, `onChange`, `onSave`
- Edit/Preview toggle tabs
- Edit mode: `<textarea>` with monospace font, full height
- Preview mode: `<MarkdownText>` component (already exists)
- Save button with dirty state detection

### `api.ts` additions

```ts
export async function fetchMemoryFiles(project: string): Promise<MemoryFile[]>
export async function saveMemoryFile(project: string, path: string, content: string): Promise<{ ok: boolean }>
```

## Routing Change

```tsx
// App.tsx — add new route
<Route path="/:project/memory" element={<MemoryView />} />
```

## BDD Test Scenarios

Feature file: `test/e2e/features/memory-management.feature`

1. **Memory page shows file list** — navigate to memory page, verify file list contains company.md and role files
2. **Clicking a file shows its content in preview** — click a file, verify rendered markdown is visible
3. **Switching to edit mode shows raw markdown** — click Edit tab, verify textarea with raw content
4. **Editing and saving a file persists** — switch to edit, modify content, save, refresh, verify change persisted
5. **Unsaved changes prompt on file switch** — edit a file, click another file, verify confirm dialog

## Security

- Path validation on `PUT /api/memory`: only allow `company.md` and `roles/<role>/CLAUDE.md` or `roles/<role>/memory.md` patterns. Reject any path containing `..` or absolute paths.
