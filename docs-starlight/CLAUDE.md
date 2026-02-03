# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the Nhost documentation site built with Astro Starlight. It generates documentation for the Nhost platform including product guides, API references, tutorials, and SDK documentation.

## Build Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server at localhost:4321
pnpm build            # Production build to ./dist/
pnpm preview          # Preview production build
pnpm generate         # Generate SDK and CLI docs (requires monorepo)
pnpm lint             # Run Biome linter
pnpm lint:prose       # Run Vale prose linter on docs
pnpm test             # Build + lint + check broken links
```

## Project Structure

```
src/
├── content/docs/     # MDX documentation files (file-based routing)
├── components/       # Custom Astro components (Card, CardGroup, ThemeImage)
├── plugins/          # Custom Starlight plugins
│   └── starlight-openapi/  # OpenAPI schema → docs generator
├── schemas/          # OpenAPI specs (auth.yaml, storage.yaml)
└── styles/           # Custom CSS
```

## Architecture

### Content Organization
- Documentation lives in `src/content/docs/` as MDX files
- File paths become URL routes (e.g., `products/auth/jwt.mdx` → `/products/auth/jwt`)
- Sidebar structure is defined in `astro.config.mjs` using `starlightSidebarTopics`

### OpenAPI Plugin
The custom `starlight-openapi` plugin in `src/plugins/` generates API reference documentation from OpenAPI schemas:
- Configured in `astro.config.mjs` with `starlightOpenAPI()`
- Reads schemas from `src/schemas/auth.yaml` and `src/schemas/storage.yaml`
- Generates pages under `reference/auth/` and `reference/storage/`

### Documentation Generation
The `pnpm generate` script (`gen.sh`) generates:
1. **TypeDoc SDK docs**: From `packages/nhost-js` → `src/content/docs/reference/javascript/nhost-js/`
2. **CLI reference**: From CLI binary → `src/content/docs/reference/cli/commands.md`

This requires the full monorepo context (CLI binary and nhost-js package).

### Path Aliases
- `@components` → `./src/components/index.ts`
- `@components/*` → `./src/components/*`

## Code Style

### Linting
- **Code**: Biome (`pnpm lint`)
- **Prose**: Vale with Google style guide (`pnpm lint:prose`)
- The `starlight-openapi` plugin is excluded from Biome linting

### MDX Frontmatter
Documentation files support standard Starlight frontmatter plus an optional `keywords` array:
```yaml
---
title: Page Title
keywords: ['graphql', 'api']
---
```
