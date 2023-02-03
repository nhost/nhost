import { DetailedHTMLProps, HTMLProps } from 'react'
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter'
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { nightOwl } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import { twMerge } from 'tailwind-merge'
import { LineGrid } from '../LineGrid'

export interface CodeSnippetProps extends SyntaxHighlighterProps {
  /**
   * Whether to disable the line grid in the background.
   */
  disableLineGrid?: boolean
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
  disableLineGrid,
  language = 'bash',
  children,
  customStyle,
  slotProps,
  ...props
}: CodeSnippetProps) {
  return (
    <div
      className={twMerge(
        'code-snippet relative z-0 w-full',
        'before:absolute before:left-0 before:right-0 before:bottom-0 before:top-0',
        'before:bg-brand-main before:bg-opacity-30',
        'before:z-0 before:h-full before:w-full before:rounded-full',
        'before:skew-x-12 before:skew-y-3 before:blur-[32px]',
        slotProps?.root?.className,
      )}
      {...(slotProps?.root || {})}
    >
      {!disableLineGrid && (
        <LineGrid className="translate-x-0 scale-y-125 overflow-hidden" />
      )}

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
