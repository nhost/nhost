import { createMarkdownProcessor } from '@astrojs/markdown-remark'

const processor = await createMarkdownProcessor()

export async function transformMarkdown(markdown: string) {
  const result = await processor.render(markdown)

  return result.code
}
