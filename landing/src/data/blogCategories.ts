/**
 * The blog's category taxonomy.
 *
 * Categories are deliberately separate from `tags`. Tags are freeform and there
 * are over seventy of them, which makes them useful for describing a post but
 * useless for navigating the blog. A category is the one section a post belongs
 * to, and this list is the single source of truth: the order here is the order
 * sections appear on /blog.
 *
 * Adding a category means adding it here and setting `category` on the posts
 * that belong to it. `Article['category']` is typed from this list, so a typo
 * or a missing category fails typecheck rather than silently dropping posts out
 * of the blog.
 */

export interface BlogCategory {
  /** URL segment, used by /blog/category/<slug>. */
  slug: string
  /** Heading shown on /blog and on the category page. */
  label: string
  /** One line under the heading, explaining what belongs here. */
  description: string
}

export const blogCategories = [
  {
    slug: 'announcements',
    label: 'Announcements',
    description:
      'New products, platform capabilities, regions, and releases.',
  },
  {
    slug: 'engineering',
    label: 'Engineering',
    description:
      'How we build and run Nhost, in detail.',
  },
  {
    slug: 'guides',
    label: 'Guides',
    description:
      'Tutorials, templates, and walkthroughs for building on Nhost.',
  },
  {
    slug: 'comparisons',
    label: 'Comparisons',
    description: 'How Nhost compares to other backends.',
  },
  {
    slug: 'customers',
    label: 'Customer stories',
    description: 'What teams have shipped on Nhost.',
  },
  {
    slug: 'company',
    label: 'Company',
    description: 'Funding, milestones, and periodic roundups.',
  },
] as const satisfies readonly BlogCategory[]

/** Union of the valid category slugs, e.g. `'announcements' | 'engineering'`. */
export type BlogCategorySlug = (typeof blogCategories)[number]['slug']

const categoriesBySlug = new Map<string, BlogCategory>(
  blogCategories.map((category) => [category.slug, category]),
)

/** The category for a slug, or `undefined` when the slug is not one of ours. */
export function getBlogCategory(slug: string): BlogCategory | undefined {
  return categoriesBySlug.get(slug)
}

/** Display label for a slug, falling back to the raw slug. */
export function getBlogCategoryLabel(slug: string): string {
  return categoriesBySlug.get(slug)?.label ?? slug
}
