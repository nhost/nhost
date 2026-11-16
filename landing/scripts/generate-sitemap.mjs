// Generates the sitemap with next-sitemap.
//
// `lastmod` for non-blog pages is derived from git history (see
// next-sitemap.config.js), which is only reliable where the FULL git history is
// available. Vercel uses a shallow clone, so we deliberately DO NOT generate the
// sitemap there — Vercel serves the committed public/sitemap*.xml instead.
//
// Workflow: regenerate locally (`pnpm build` or `pnpm run postbuild`) after
// committing your changes, then commit the updated public/sitemap*.xml.
import { execSync } from 'node:child_process'

if (process.env.VERCEL) {
  console.log(
    '▲ Vercel build detected — skipping next-sitemap. Serving the committed public/sitemap*.xml.',
  )
  process.exit(0)
}

execSync('next-sitemap', { stdio: 'inherit' })
