import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchMemoryFiles, saveMemoryFile, type MemoryFile } from '../lib/api'
import MemoryFileList from '../components/MemoryFileList'
import MemoryEditor from '../components/MemoryEditor'

export default function MemoryView() {
  const { project } = useParams<{ project: string }>()
  const [files, setFiles] = useState<MemoryFile[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [savedContent, setSavedContent] = useState('')

  useEffect(() => {
    if (!project) return
    fetchMemoryFiles(project).then((f) => {
      setFiles(f)
      if (f.length > 0 && !activePath) {
        setActivePath(f[0].path)
        setEditContent(f[0].content)
        setSavedContent(f[0].content)
      }
    })
  }, [project])

  const handleSelect = useCallback((path: string) => {
    if (path === activePath) return
    const dirty = editContent !== savedContent
    if (dirty && !window.confirm('You have unsaved changes. Discard them?')) return
    setActivePath(path)
    const file = files.find((f) => f.path === path)
    if (file) {
      setEditContent(file.content)
      setSavedContent(file.content)
    }
  }, [activePath, editContent, savedContent, files])

  const handleSave = useCallback(async () => {
    if (!project || !activePath) return
    await saveMemoryFile(project, activePath, editContent)
    setSavedContent(editContent)
    setFiles((prev) =>
      prev.map((f) => (f.path === activePath ? { ...f, content: editContent } : f))
    )
  }, [project, activePath, editContent])

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center gap-2 text-sm shrink-0">
        <Link to="/" className="text-gray-400 hover:text-gray-600">All Projects</Link>
        <span className="text-gray-300">/</span>
        <Link to={`/${encodeURIComponent(project!)}`} className="text-gray-400 hover:text-gray-600">{project}</Link>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-gray-900">Memory</span>
      </header>
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <MemoryFileList
          files={files}
          activePath={activePath}
          onSelect={handleSelect}
        />
        <main className="flex-1 flex flex-col overflow-hidden bg-white">
          {activePath ? (
            <MemoryEditor
              content={editContent}
              savedContent={savedContent}
              onChange={setEditContent}
              onSave={handleSave}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a file to view
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
