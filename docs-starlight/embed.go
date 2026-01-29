package docsembed

import "embed"

//go:embed src/content/docs/*.mdx
//go:embed src/content/docs/*/*.mdx
//go:embed src/content/docs/*/*/*.mdx
//go:embed src/content/docs/*/*/*/*.mdx
//go:embed src/content/docs/*/*/*/*/*.mdx
//go:embed src/content/docs/*/*/*/*/*/*.mdx
var DocsFS embed.FS

const DocsRoot = "src/content/docs"
