package docsembed

import "embed"

//go:embed docs.json
//go:embed *.mdx
//go:embed */*.mdx
//go:embed */*/*.mdx
//go:embed */*/*/*.mdx
//go:embed */*/*/*/*.mdx
//go:embed */*/*/*/*/*.mdx
var DocsFS embed.FS
