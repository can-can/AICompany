import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown'
import remarkGfm from 'remark-gfm'
import { type ComponentPropsWithoutRef, type FC, memo } from 'react'
import ShikiHighlighter from 'react-shiki'

const SyntaxHighlighter: FC<ComponentPropsWithoutRef<'code'> & { language?: string }> = ({
  language,
  children,
}) => {
  return (
    <ShikiHighlighter language={language ?? 'text'} theme="github-dark">
      {String(children)}
    </ShikiHighlighter>
  )
}

const MarkdownText = () => (
  <MarkdownTextPrimitive
    remarkPlugins={[remarkGfm]}
    className="prose prose-sm max-w-none dark:prose-invert prose-pre:p-0 prose-pre:bg-transparent"
    components={{
      SyntaxHighlighter: memo(SyntaxHighlighter),
    }}
  />
)

export default MarkdownText
