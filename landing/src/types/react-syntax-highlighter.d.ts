// Local, React 19-compatible type declarations for react-syntax-highlighter.
//
// The published `@types/react-syntax-highlighter` package hard-depends on
// `@types/react@^18`, which drags a second React type tree into the workspace
// and makes `<SyntaxHighlighter>` fail as a JSX component under React 19. We
// only use `PrismAsyncLight` and the prism styles, so we declare the subset we
// need against the app's own (React 19) types instead.
declare module 'react-syntax-highlighter' {
  import type { ComponentType, CSSProperties } from 'react'

  export interface SyntaxHighlighterProps {
    language?: string
    style?: { [key: string]: CSSProperties }
    customStyle?: CSSProperties
    codeTagProps?: Record<string, unknown>
    useInlineStyles?: boolean
    showLineNumbers?: boolean
    showInlineLineNumbers?: boolean
    startingLineNumber?: number
    lineNumberStyle?: CSSProperties | ((lineNumber: number) => CSSProperties)
    wrapLines?: boolean
    wrapLongLines?: boolean
    lineProps?: unknown
    renderer?: unknown
    PreTag?: unknown
    CodeTag?: unknown
    children: string | string[]
    // react-syntax-highlighter forwards arbitrary props to the underlying tags.
    [key: string]: unknown
  }

  export const Prism: ComponentType<SyntaxHighlighterProps>
  export const PrismAsync: ComponentType<SyntaxHighlighterProps>
  export const PrismLight: ComponentType<SyntaxHighlighterProps>
  export const PrismAsyncLight: ComponentType<SyntaxHighlighterProps>
  export const Light: ComponentType<SyntaxHighlighterProps>
  export const LightAsync: ComponentType<SyntaxHighlighterProps>

  const SyntaxHighlighter: ComponentType<SyntaxHighlighterProps>
  export default SyntaxHighlighter
}

declare module 'react-syntax-highlighter/dist/cjs/styles/prism' {
  import type { CSSProperties } from 'react'

  type PrismStyle = { [key: string]: CSSProperties }

  export const nightOwl: PrismStyle
  const styles: PrismStyle
  export default styles
}
