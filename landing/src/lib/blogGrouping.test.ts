import {
  findUrlClashes,
  getLeadArticle,
  getPage,
  getPopularTags,
  listingPath,
  pageCount,
  parsePageParam,
  POSTS_PER_PAGE,
  tagPath,
  tagSlug,
} from '@/lib/blogGrouping'
import { Article } from '@/utils/types'
import { describe, expect, it } from 'vitest'

function article(overrides: Partial<Article> = {}): Article {
  return {
    title: 'Post',
    description: 'A post',
    image: '/images/blog/post.png',
    date: '2026-01-01',
    authors: [],
    tags: [],
    readingMinutes: 1,
    slug: 'post',
    ...overrides,
  }
}

function articles(count: number): Article[] {
  return Array.from({ length: count }, (_, index) =>
    article({ slug: `post-${index}` }),
  )
}

describe('getLeadArticle', () => {
  it('returns the first featured post', () => {
    const posts = [
      article({ slug: 'a' }),
      article({ slug: 'b', featured: true }),
      article({ slug: 'c', featured: true }),
    ]

    expect(getLeadArticle(posts)?.slug).toBe('b')
  })

  it('returns null when nothing is featured', () => {
    expect(getLeadArticle([article()])).toBeNull()
  })
})

describe('getPopularTags', () => {
  it('keeps tags on three or more posts, most used first, ties by name', () => {
    const posts = [
      article({ tags: ['Auth', 'AI', 'Rare'] }),
      article({ tags: ['Auth', 'AI', 'Rare'] }),
      article({ tags: ['Auth', 'AI', 'Platform'] }),
      article({ tags: ['Auth', 'Platform'] }),
      article({ tags: ['Platform'] }),
    ]

    expect(getPopularTags(posts)).toEqual(['Auth', 'AI', 'Platform'])
  })
})

describe('tagSlug', () => {
  it.each([
    ['Auth', 'auth'],
    ['Next.js', 'nextjs'],
    ['Open Source', 'open-source'],
    ['  C++ / Rust ', 'c-rust'],
  ])('%s becomes %s', (tag, slug) => {
    expect(tagSlug(tag)).toBe(slug)
  })
})

describe('listing paths', () => {
  it('keeps page 1 at the base path', () => {
    expect(listingPath('/blog', 1)).toBe('/blog')
    expect(listingPath('/blog', 3)).toBe('/blog/page/3')
  })

  it('builds tag paths from the slug', () => {
    expect(tagPath('Next.js')).toBe('/blog/tag/nextjs')
    expect(tagPath('Next.js', 2)).toBe('/blog/tag/nextjs/page/2')
  })
})

describe('pagination', () => {
  it('counts pages, with at least one', () => {
    expect(pageCount(0)).toBe(1)
    expect(pageCount(POSTS_PER_PAGE)).toBe(1)
    expect(pageCount(POSTS_PER_PAGE + 1)).toBe(2)
  })

  it('slices a page counting from 1', () => {
    const posts = articles(POSTS_PER_PAGE + 2)

    expect(getPage(posts, 1)).toHaveLength(POSTS_PER_PAGE)
    expect(getPage(posts, 2).map((post) => post.slug)).toEqual([
      `post-${POSTS_PER_PAGE}`,
      `post-${POSTS_PER_PAGE + 1}`,
    ])
  })

  it.each([
    ['2', 3, 2],
    ['3', 3, 3],
    ['1', 3, null],
    ['4', 3, null],
    ['02', 3, null],
    ['two', 3, null],
    [undefined, 3, null],
    [['2'], 3, null],
  ])('parses page param %j of %i pages as %j', (param, total, expected) => {
    expect(parsePageParam(param, total)).toBe(expected)
  })
})

describe('findUrlClashes', () => {
  it('reports nothing for distinct URLs', () => {
    expect(findUrlClashes(articles(3))).toEqual([])
  })

  it('reports posts on reserved listing slugs', () => {
    expect(findUrlClashes([article({ slug: 'tag' })])).toEqual([
      'Post "tag" uses a URL reserved for blog listings. Rename it.',
    ])
  })

  it('reports popular tags that share a slug', () => {
    const posts = Array.from({ length: 3 }, () =>
      article({ tags: ['Next.js', 'NextJS'] }),
    )

    expect(findUrlClashes(posts)).toEqual([
      'Tags "Next.js", "NextJS" all map to /blog/tag/nextjs. Merge or rename them.',
    ])
  })
})
