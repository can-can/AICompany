import { useState, useRef, useLayoutEffect, type ReactNode } from 'react'

const COLLAPSED_HEIGHT = 300

export default function CollapsibleMessage({
  children,
  fadeColor = 'from-gray-100',
}: {
  children: ReactNode
  fadeColor?: string
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const check = () => setIsOverflowing(el.scrollHeight > COLLAPSED_HEIGHT)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div>
      <div
        ref={contentRef}
        className={!expanded && isOverflowing ? 'relative overflow-hidden' : ''}
        style={!expanded && isOverflowing ? { maxHeight: COLLAPSED_HEIGHT } : undefined}
      >
        {children}
        {!expanded && isOverflowing && (
          <div className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t ${fadeColor} to-transparent pointer-events-none`} />
        )}
      </div>
      {isOverflowing && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-blue-600 hover:text-blue-800"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}
