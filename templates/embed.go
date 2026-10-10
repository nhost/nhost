// Package templates exposes the starter templates `nhost init --template`
// scaffolds as an embedded filesystem, so the CLI carries them in its binary
// instead of fetching them at runtime.
//
// A template is a directory whose top-level entries are laid over the project
// root. The directives below name a template's entries explicitly rather than
// embedding the directory whole: a developer who has run `pnpm install` inside
// the template has a node_modules there, and a blanket directive would carry
// it into every local `go build`. embed_test.go is what catches an entry added
// on disk but not here.
package templates

import "embed"

// FS holds every shipped template, rooted at this directory: a file's path
// inside it is `<template>/<path within the template>`.
//
//go:embed nextjs/AGENTS.md nextjs/CLAUDE.md nextjs/SKILLS.md
//go:embed all:nextjs/.claude
//go:embed nextjs/frontend/.env.example nextjs/frontend/.gitignore
//go:embed nextjs/frontend/README.md
//go:embed nextjs/frontend/biome.json nextjs/frontend/components.json
//go:embed nextjs/frontend/next.config.ts nextjs/frontend/package.json
//go:embed nextjs/frontend/pnpm-lock.yaml nextjs/frontend/pnpm-workspace.yaml
//go:embed nextjs/frontend/postcss.config.mjs nextjs/frontend/tsconfig.json
//go:embed nextjs/frontend/vitest.config.ts
//go:embed all:nextjs/frontend/src
//go:embed all:nextjs/ui
//go:embed react/AGENTS.md react/CLAUDE.md react/SKILLS.md
//go:embed all:react/.claude
//go:embed react/frontend/.env.example react/frontend/.gitignore
//go:embed react/frontend/README.md
//go:embed react/frontend/biome.json react/frontend/components.json
//go:embed react/frontend/index.html react/frontend/package.json
//go:embed react/frontend/pnpm-lock.yaml react/frontend/pnpm-workspace.yaml
//go:embed react/frontend/tsconfig.json react/frontend/vite.config.ts
//go:embed all:react/frontend/src
//go:embed all:react/ui
var FS embed.FS
