import {
  findUrlClashes,
  getLeadArticle,
  getTags,
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

describe('getTags', () => {
  it('lists every tag, most used first, ties by name', () => {
    const posts = [
      article({ tags: ['Auth', 'AI', 'Rare'] }),
      article({ tags: ['Auth', 'AI'] }),
      article({ tags: ['Auth', 'Platform'] }),
      article({ tags: ['Platform'] }),
    ]

    expect(getTags(posts)).toEqual(['Auth', 'AI', 'Platform', 'Rare'])
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

describe('tagPath', () => {
  it('builds the path from the slug', () => {
    expect(tagPath('Next.js')).toBe('/blog/tag/nextjs')
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

  it('reports tags that share a slug', () => {
    const posts = [
      article({ tags: ['Next.js'] }),
      article({ tags: ['NextJS'] }),
    ]

    expect(findUrlClashes(posts)).toEqual([
      'Tags "Next.js", "NextJS" all map to /blog/tag/nextjs. Merge or rename them.',
    ])
  })
})
