import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Command } from 'cmdk'

export type SlashCommand = {
  value: string
  label: string
  description: string
}

const builtinCommands: SlashCommand[] = [
  { value: 'stop', label: '/stop', description: 'Stop running agent' },
  { value: 'clear', label: '/clear', description: 'Clear chat messages' },
  { value: 'help', label: '/help', description: 'Show available commands' },
]

function clearTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(el, '')
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export function useSlashCommands(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  onExecute: (command: string) => void,
) {
  const [inputValue, setInputValue] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filtered = useMemo(() => {
    if (!menuOpen) return []
    const query = inputValue.slice(1).toLowerCase()
    return builtinCommands.filter(c => c.value.startsWith(query))
  }, [inputValue, menuOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [filtered.length])

  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const val = e.currentTarget.value
    setInputValue(val)
    setMenuOpen(val.startsWith('/'))
  }, [])

  const execute = useCallback((value: string) => {
    setMenuOpen(false)
    setInputValue('')
    clearTextarea(textareaRef.current)
    onExecute(value)
  }, [textareaRef, onExecute])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!menuOpen || filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => (i + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[selectedIndex]
      if (cmd) execute(cmd.value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMenuOpen(false)
    }
  }, [menuOpen, filtered, selectedIndex, execute])

  const close = useCallback(() => {
    setMenuOpen(false)
    setInputValue('')
  }, [])

  return { menuOpen, filtered, selectedIndex, setSelectedIndex, handleInput, handleKeyDown, execute, close }
}

export default function SlashCommandMenu({
  commands,
  selectedIndex,
  onSelect,
  onHover,
}: {
  commands: SlashCommand[]
  selectedIndex: number
  onSelect: (value: string) => void
  onHover: (index: number) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const selected = el.children[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (commands.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 z-10">
      <Command shouldFilter={false} label="Slash commands">
        <Command.List
          ref={listRef}
          className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto"
        >
          {commands.map((cmd, i) => (
            <Command.Item
              key={cmd.value}
              value={cmd.value}
              onSelect={() => onSelect(cmd.value)}
              onMouseEnter={() => onHover(i)}
              className="px-3 py-2 text-sm cursor-pointer flex items-center gap-2"
              data-selected={i === selectedIndex || undefined}
              style={{
                backgroundColor: i === selectedIndex ? 'rgb(239 246 255)' : undefined,
                color: i === selectedIndex ? 'rgb(29 78 216)' : 'rgb(55 65 81)',
              }}
            >
              <span className="font-medium font-mono">{cmd.label}</span>
              <span className="text-gray-400">{cmd.description}</span>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  )
}
