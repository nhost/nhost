# Nhost Documentation

This is the source for [docs.nhost.io](https://docs.nhost.io), built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build).

## Project Structure

```
docs/
├── public/              # Static assets (favicons, etc.)
├── src/
│   ├── assets/          # Images and other assets
│   ├── components/      # Custom Astro components
│   ├── content/
│   │   └── docs/        # Documentation pages (.md/.mdx)
│   ├── plugins/         # Custom Starlight plugins
│   ├── schemas/         # OpenAPI schemas for API reference
│   └── styles/          # Custom CSS
├── astro.config.mjs     # Astro/Starlight configuration
└── package.json
```

## Development

```bash
# Install dependencies
pnpm install

# Start dev server at localhost:4321
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Writing Documentation

Documentation pages live in `src/content/docs/`. Each `.md` or `.mdx` file becomes a page based on its path:

- `src/content/docs/products/auth.md` → `/products/auth/`
- `src/content/docs/getting-started/index.md` → `/getting-started/`

### Frontmatter

Every page needs frontmatter at the top:

```yaml
---
title: Page Title
description: A brief description for SEO and previews.
keywords: [keyword1, keyword2]
---
```

### Adding to Sidebar

The sidebar is configured in `astro.config.mjs` using `starlightSidebarTopics`. Add new pages to the appropriate section.

## API Reference

API documentation is auto-generated from OpenAPI schemas in `src/schemas/`. To update:

1. Edit the relevant schema file (`auth.yaml` or `storage.yaml`)
2. The pages will regenerate on build
