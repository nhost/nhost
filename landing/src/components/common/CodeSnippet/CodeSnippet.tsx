import {
  DetailedHTMLProps,
  HTMLProps,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter'
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { nightOwl } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import { twMerge } from 'tailwind-merge'
import { Glow } from '../Glow'
import { LineGrid } from '../LineGrid'
import { Copy } from 'lucide-react'
import { TickIcon } from '../icons/TickIcon'

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value)
}

export interface CodeSnippetProps extends SyntaxHighlighterProps {
  /**
   * Class name to be applied to the root element.
   */
  className?: string
  /**
   * Whether to show the copy-to-clipboard button.
   *
   * @default false
   */
  showCopyButton?: boolean
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
  className,
  showCopyButton = false,
  ...props
}: CodeSnippetProps) {
  const [hasCopied, setHasCopied] = useState(false)
  const codeText = useMemo(
    () => (typeof children === 'string' ? children : children.join('')),
    [children],
  )

  useEffect(() => {
    if (!hasCopied) return
    const id = setTimeout(() => setHasCopied(false), 2000)
    return () => clearTimeout(id)
  }, [hasCopied])

  return (
    <div
      {...(slotProps?.root || {})}
      className={twMerge(
        'code-snippet relative z-0 w-full',
        className,
        slotProps?.root?.className,
      )}
    >
      {showCopyButton && (
        <button
          type="button"
          aria-label={hasCopied ? 'Copied' : 'Copy to clipboard'}
          onClick={() => {
            if (!codeText) return
            copyToClipboard(codeText)
            setHasCopied(true)
          }}
          className={twMerge(
            'absolute right-2 top-2 z-20 inline-grid h-6 w-6 place-items-center rounded-md border border-white border-opacity-10 bg-black bg-opacity-40 p-0 text-xs',
            'hover:bg-opacity-60 motion-safe:transition-colors',
          )}
        >
          {hasCopied ? (
            <>
              <TickIcon className="h-4 w-4" />
              <span className="sr-only">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span className="sr-only">Copy</span>
            </>
          )}
        </button>
      )}

      {!disableGlow && (
        <Glow className="top-1/2 h-[92%] w-[97%] -translate-y-1/2 skew-x-6 skew-y-3 bg-opacity-30 blur-3xl" />
      )}

      {!disableLineGrid && (
        <LineGrid className="h-[135%] w-[135%] -translate-x-[20%] -translate-y-[15%] transform-cpu" />
      )}

      <SyntaxHighlighter
        language={language}
        style={nightOwl}
        wrapLongLines
        wrapLines
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
