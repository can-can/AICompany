import { useState, useEffect, useCallback } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MemoryEditor({
  content,
  savedContent,
  onChange,
  onSave,
}: {
  content: string
  savedContent: string
  onChange: (value: string) => void
  onSave: () => void
}) {
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')
  const [saving, setSaving] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const dirty = content !== savedContent

  useEffect(() => {
    setMode('preview')
  }, [savedContent])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await onSave()
      setShowSaved(true)
      setTimeout(() => setShowSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [onSave])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 shrink-0">
        <div className="flex gap-1">
          <button
            onClick={() => setMode('edit')}
            className={`px-3 py-1 text-sm rounded ${
              mode === 'edit'
                ? 'bg-gray-200 text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Edit
          </button>
          <button
            onClick={() => setMode('preview')}
            className={`px-3 py-1 text-sm rounded ${
              mode === 'preview'
                ? 'bg-gray-200 text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Preview
          </button>
        </div>
        <div className="flex items-center gap-2">
          {showSaved && (
            <span className="text-sm text-green-600">Saved</span>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={`px-4 py-1.5 text-sm font-medium rounded ${
              dirty
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {mode === 'edit' ? (
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-full p-4 font-mono text-sm resize-none outline-none bg-white"
            spellCheck={false}
          />
        ) : (
          <div className="p-4 prose prose-sm max-w-none">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        )}
      </div>
    </div>
  )
}
