import { CodeBlock } from 'react-code-block'
import { themes } from 'prism-react-renderer'
import { Button } from './button'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'

interface CodeBlockProps {
  code: string
  language: string
}

export default function Code({ code, language }: CodeBlockProps) {
  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code)
    toast.info('Code copied to clipboard')
  }

  return (
    <CodeBlock code={code} language={language} theme={themes.github}>
      <div className="relative">
        <CodeBlock.Code className="p-4 overflow-auto rounded-md bg-muted/60">
          <CodeBlock.LineContent>
            <CodeBlock.Token />
          </CodeBlock.LineContent>
        </CodeBlock.Code>
        <Button className="absolute top-2 right-2" variant="outline" onClick={copyToClipboard}>
          <Copy className="w-5 h-5" />
        </Button>
      </div>
    </CodeBlock>
  )
}
