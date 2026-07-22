const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const PAGES_DIR = path.join(__dirname, 'src', 'pages')

/**
 * Resolve the source file that backs a given route path, so we can derive a
 * meaningful `lastmod` from it.
 */
function resolveSourceFile(routePath) {
  const clean = routePath.replace(/\/+$/, '')

  // Job detail pages are generated from a single data file.
  if (/^\/careers\/.+/.test(clean)) {
    return path.join(__dirname, 'src', 'data', 'jobs.ts')
  }

  const rel = clean === '' ? '/index' : clean
  const candidates = [
    `${rel}.mdx`,
    `${rel}.tsx`,
    `${rel}/index.mdx`,
    `${rel}/index.tsx`,
  ].map((candidate) => path.join(PAGES_DIR, candidate))

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  // Fall back to a dynamic route in the parent directory (e.g. [slug].tsx).
  const segments = clean.split('/').filter(Boolean)
  if (segments.length > 1) {
    const parent = segments.slice(0, -1).join('/')
    const dynamicCandidates = [
      path.join(PAGES_DIR, parent, '[slug].tsx'),
      path.join(PAGES_DIR, parent, '[slug].mdx'),
      path.join(PAGES_DIR, parent, '[...slug].tsx'),
    ]
    for (const candidate of dynamicCandidates) {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }
  }

  return null
}

/** Last commit date that touched a file, as an ISO string (or null). */
function gitLastmod(file) {
  try {
    const out = execSync(`git log -1 --format=%cI -- "${file}"`, {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
    return out || null
  } catch (error) {
    return null
  }
}

/**
 * `lastmod` for a blog post, as an ISO string (or null).
 *
 * Prefers the `updatedAt` field (set when the body is meaningfully changed) and
 * falls back to the original `date` (publish date) from the post's `article`.
 */
function blogLastmod(file) {
  try {
    const content = fs.readFileSync(file, 'utf8')
    const updated = content.match(/updatedAt:\s*['"](\d{4}-\d{2}-\d{2})['"]/)
    const published = content.match(/date:\s*['"](\d{4}-\d{2}-\d{2})['"]/)
    const chosen = (updated && updated[1]) || (published && published[1])
    if (chosen) {
      return new Date(`${chosen}T00:00:00.000Z`).toISOString()
    }
  } catch (error) {
    // ignore and fall through
  }
  return null
}

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://nhost.io',
  generateRobotsTxt: true,
  // We compute `lastmod` per URL in `transform` instead of stamping the build time.
  autoLastmod: false,
  transform: async (config, routePath) => {
    const file = resolveSourceFile(routePath)

    let lastmod = null
    if (/^\/blog\/.+/.test(routePath) && file) {
      // Blog posts: use `updatedAt` (or `date`) from the post, falling back to git.
      lastmod = blogLastmod(file) || gitLastmod(file)
    } else if (file) {
      // Everything else: when the source was last actually changed.
      lastmod = gitLastmod(file)
    }

    const entry = {
      loc: routePath,
      changefreq: config.changefreq,
      priority: config.priority,
      alternateRefs: config.alternateRefs ?? [],
    }

    // Only emit `lastmod` when we have a real signal (frontmatter date or git
    // commit date). With `git` available in the dev shell this resolves for
    // every committed page; for the rare unresolved case (e.g. a brand-new,
    // uncommitted page) we omit `lastmod` — which is valid and deterministic —
    // rather than stamp the build time, which would churn on every run.
    if (lastmod) {
      entry.lastmod = lastmod
    }

    return entry
  },
}
