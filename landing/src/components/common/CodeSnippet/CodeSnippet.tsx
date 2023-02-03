import { DetailedHTMLProps, HTMLProps } from 'react'
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter'
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { nightOwl } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import { twMerge } from 'tailwind-merge'

export interface CodeSnippetProps extends SyntaxHighlighterProps {
  /**
   * Props passed to component slots.
   */
  slotProps?: {
    /**
     * Props passed to the root element.
     */
    root?: DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>
  }
}

export default function CodeSnippet({
  language = 'bash',
  children,
  customStyle,
  slotProps,
  ...props
}: CodeSnippetProps) {
  return (
    <div
      className={twMerge(
        'relative w-full',
        'after:absolute after:left-0 after:right-0 after:bottom-0 after:top-0',
        'after:bg-brand-main after:bg-opacity-30',
        'after:z-0 after:h-full after:w-full after:rounded-full',
        'after:skew-x-12 after:skew-y-3 after:blur-[32px]',
        slotProps?.root?.className,
      )}
      {...(slotProps?.root || {})}
    >
      <SyntaxHighlighter
        language={language}
        style={nightOwl}
        wrapLongLines
        customStyle={{
          position: 'relative',
          margin: 0,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'none',
          backgroundColor: '#080808 !important',
          borderRadius: 6,
          padding: 32,
          zIndex: 1,
          ...customStyle,
        }}
        {...props}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}
