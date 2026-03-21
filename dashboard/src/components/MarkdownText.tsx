import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown'
import remarkGfm from 'remark-gfm'
import { type FC, memo } from 'react'
import ShikiHighlighter from 'react-shiki'

const SyntaxHighlighter: FC<{ language?: string; code?: string; children?: string }> = ({
  language,
  code,
  children,
}) => {
  return (
    <ShikiHighlighter language={language ?? 'text'} theme="github-dark">
      {String(code ?? children ?? '')}
    </ShikiHighlighter>
  )
}

const remarkPlugins = [remarkGfm]
const MemoizedHighlighter = memo(SyntaxHighlighter)
const markdownComponents = { SyntaxHighlighter: MemoizedHighlighter }

const MarkdownText = () => (
  <MarkdownTextPrimitive
    remarkPlugins={remarkPlugins}
    className="prose prose-sm max-w-none dark:prose-invert prose-pre:p-0 prose-pre:bg-transparent"
    components={markdownComponents}
  />
)

export default MarkdownText
