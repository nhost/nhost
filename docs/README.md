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

## Reference Documentation (generated)

The reference pages under `src/content/docs/reference/` are generated from source and
committed to the repo, so `pnpm dev`/`pnpm build` use them as-is. Run `pnpm generate` only
after changing one of their sources, then commit the result:

| Source changed | Regenerated output |
| --- | --- |
| CLI command tree (`cli/`; see `internal/lib/clidocs`) | `reference/cli/commands.mdx` |
| `packages/nhost-js` (TypeDoc) | `reference/javascript/nhost-js/**` |
| `packages/nhost-python` (introspection → `pydoc-to-md.py`; docs-check python env, `uv` fallback locally) | `reference/python/nhost-python/**` |
| OpenAPI schemas (auth, storage) | `src/schemas/*.yaml` |

Run it in the docs Nix dev shell (`nix develop .#docs`, which provides the `cli` binary)
on Linux — the TypeDoc/OpenAPI steps use GNU `sed`, which misbehaves on macOS.

### Testing the CLI reference generator

The CLI reference generator (`internal/lib/clidocs`) has golden-file tests: they render a
sample command tree and compare it to `internal/lib/clidocs/testdata/commands.golden`. The
full import path lets you run them from any directory (e.g. this `docs/` folder):

```bash
go test github.com/nhost/nhost/internal/lib/clidocs                  # run
UPDATE_GOLDEN=1 go test github.com/nhost/nhost/internal/lib/clidocs  # update the golden after an intended change
```

CI runs these via `cli_checks` (it watches `internal/lib/clidocs/**`), so any change to the
generated output fails the build until the golden is regenerated and committed.
