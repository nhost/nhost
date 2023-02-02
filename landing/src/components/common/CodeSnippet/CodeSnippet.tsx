import type { SyntaxHighlighterProps } from 'react-syntax-highlighter'
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { twilight } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import { twMerge } from 'tailwind-merge'

export interface CodeSnippetProps extends SyntaxHighlighterProps {}

export default function CodeSnippet({
  language = 'bash',
  children,
  customStyle,
  ...props
}: CodeSnippetProps) {
  return (
    <div
      className={twMerge(
        'relative',
        'after:absolute after:left-0 after:right-0 after:bottom-0 after:top-0',
        'after:z-0 after:h-full after:w-full after:rounded-full',
        'after:skew-x-6 after:skew-y-3 after:bg-brand-main after:bg-opacity-30 after:blur-[32px]',
      )}
    >
      <SyntaxHighlighter
        language={language}
        style={twilight}
        wrapLongLines
        customStyle={{
          ...customStyle,
          position: 'relative',
          margin: 0,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'none',
          backgroundColor: '#080808',
          padding: 32,
          zIndex: 1,
        }}
        {...props}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}
