import { lightNhostTheme } from '@/data/lightTheme'
import { useState } from 'react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import js from 'react-syntax-highlighter/dist/cjs/languages/hljs/javascript'
import jsx from 'react-syntax-highlighter/dist/cjs/languages/prism/jsx'

import Check from '../icons/Check'
import Copy from '../icons/Copy'

// @ts-ignore -> add to types
// @ts-ignore -> add to types
SyntaxHighlighter.registerLanguage('js', js)
SyntaxHighlighter.registerLanguage('jsx', jsx)

export interface CodeEditorProps {
  code: string
  fileName: string
  className: string
  fixed: boolean
  gradient: boolean
  deploy: boolean
  url?: string
  children: any
}

const CodeEditor = (props: CodeEditorProps) => {
  const { children, url } = props
  const [copied, setCopied] = useState(false)

  return (
    <div className="relative min-w-full pb-0 my-4 rounded-md">
      <div className="absolute right-0">
        <button
          className="ml-1.5 self-center inline-block cursor-pointer rounded-md mt-2 mr-2"
          onClick={() => {
            navigator.clipboard.writeText(children).catch((e) => {
              // eslint-disable-next-line no-console
              console.log(e)
            })
            setCopied(true)
            setTimeout(() => {
              setCopied(false)
            }, 1000)
          }}
        >
          {/* <Tooltip text={"Copied!"}> */}
          {copied ? (
            <Check className="w-3.5 h-3.5 mr-0.5 text-greenDark transition-colors self-center" />
          ) : (
            <Copy className="w-4 h-4 text-gray-500 transition-colors hover:text-gray-900" />
          )}
          {/* </Tooltip> */}
        </button>
      </div>
      <SyntaxHighlighter
        style={lightNhostTheme}
        wrapLongLines={true}
        wrapLines={true}
        lineProps={{
          style: { wordBreak: 'break-all', whiteSpace: 'pre-wrap' }
        }}
        customStyle={{
          paddingLeft: '12px',
          fontSize: '13px'
        }}
        className="pt-2 rounded-md"
        showLineNumbers={false}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}

export default CodeEditor
