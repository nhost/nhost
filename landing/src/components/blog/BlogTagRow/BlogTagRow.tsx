import { TAG_ROW_SIZE, tagPath } from '@/lib/blogGrouping'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

export interface BlogTagRowProps {
  /** Every tag, most used first. */
  tags: string[]
  /** The tag whose listing this is, or `null` on /blog. */
  activeTag: string | null
  /** The current search, carried to the listing a tag links to. */
  query: string
  className?: string
}

const chipClassName =
  'block whitespace-nowrap rounded-full border border-transparent px-2.5 py-1 text-[13px] font-medium leading-5 text-white text-opacity-65 hover:border-white hover:border-opacity-30 hover:text-opacity-100 hover:no-underline motion-safe:transition-colors'

const activeChipClassName =
  'border-white bg-white text-black text-opacity-100 hover:border-white hover:border-opacity-100 hover:bg-white'

interface TagChipProps {
  tag: string | null
  activeTag: string | null
  query: string
}

/**
 * Links keep the scroll position: the page above the row is the same on every
 * listing, so the row stays put and only the posts below change.
 */
function TagChip({ tag, activeTag, query }: TagChipProps) {
  const active = tag === activeTag
  const pathname = tag === null ? '/blog' : tagPath(tag)

  return (
    <Link
      href={query.trim() ? { pathname, query: { q: query } } : pathname}
      scroll={false}
      aria-current={active ? 'page' : undefined}
      className={twMerge(chipClassName, active && activeChipClassName)}
    >
      {tag ?? 'All'}
    </Link>
  )
}

/** "All" and the most used tags, each a link to its prerendered listing. */
export default function BlogTagRow({
  tags,
  activeTag,
  query,
  className,
}: BlogTagRowProps) {
  return (
    <nav
      aria-label="Browse by tag"
      className={twMerge('flex min-w-0 flex-wrap gap-1', className)}
    >
      <TagChip tag={null} activeTag={activeTag} query={query} />

      {tags.slice(0, TAG_ROW_SIZE).map((tag) => (
        <TagChip key={tag} tag={tag} activeTag={activeTag} query={query} />
      ))}
    </nav>
  )
}
