import { BlogCategorySlug } from '@/data/blogCategories'

export interface Author {
  name: string
  title: string
  avatarUrl: string
  url: string
}

export interface Article {
  title: string
  description: string
  image: string
  /** Original publish date, `YYYY-MM-DD`. */
  date: string
  /**
   * Date the post's content (not its meta tags) was last meaningfully changed,
   * `YYYY-MM-DD`. Bump this when you edit the body so the sitemap `lastmod`
   * signals a real update to search engines. Defaults to `date` when absent.
   */
  updatedAt?: string
  authors: Author[]
  /**
   * Freeform labels describing the post. Useful on the post itself, too
   * granular to navigate by, which is what `category` is for.
   */
  tags: string[]
  /**
   * The one section this post belongs to on /blog. See
   * `@/data/blogCategories` for the list and what belongs in each.
   */
  category: BlogCategorySlug
  /**
   * Shows the post in the featured feed at the top of /blog. Reserved for
   * important announcements and technical deep dives: the things worth
   * leading with. Roundups, guides, and comparisons stay in their category.
   */
  featured?: boolean
  slug: string
  /** SEO meta title (without the "| Nhost Blog" suffix). Keep under 50 chars. */
  seoTitle?: string
  /** SEO meta description. Keep under 145 chars. */
  seoDescription?: string
}

export interface Customer {
  name: string
  website: {
    url: string
    display: string
  }
  description: string
  logo: {
    src: string
    width: number
    height: number
  }
  ogImage: {
    src: string
    width: number
    height: number
  }
  industry: string
  location: string
  timeToProduction: string
  problem: string
  solution: string
  slug: string
  /** SEO meta title. Keep the rendered title under 65 chars. */
  seoTitle?: string
  /** SEO meta description. Keep under 145 chars. */
  seoDescription?: string
}
