import { DetailedHTMLProps, HTMLProps } from 'react'
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter'
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { nightOwl } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import { twMerge } from 'tailwind-merge'
import { Glow } from '../Glow'
import { LineGrid } from '../LineGrid'

export interface CodeSnippetProps extends SyntaxHighlighterProps {
  /**
   * Whether to disable the line grid in the background.
   */
  disableLineGrid?: boolean
  /**
   * Determines whether to disable the glow effect.
   */
  disableGlow?: boolean
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
  disableGlow,
  language = 'bash',
  children,
  customStyle,
  slotProps,
  ...props
}: CodeSnippetProps) {
  return (
    <div
      {...(slotProps?.root || {})}
      className={twMerge(
        'code-snippet relative z-0 w-full',
        slotProps?.root?.className,
      )}
    >
      {!disableGlow && (
        <Glow className="top-1/2 h-full w-full -translate-y-1/2 skew-x-6 skew-y-3 bg-opacity-50 blur-[32px]" />
      )}

      {!disableLineGrid && (
        <LineGrid className="h-[125%] w-[125%] -translate-x-1/4 -translate-y-[12.5%] overflow-hidden" />
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
