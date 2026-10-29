import { splitTags, tagPath } from '@/lib/blogGrouping'
import { Popover } from '@headlessui/react'
import { ChevronDown, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
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

/**
 * The last tag picked from "More", kept across client-side navigation between
 * tag listings: every listing remounts the row. Cleared on /blog, and empty on
 * each full load, so hydration matches the prerendered "More".
 */
let lastMoreTag: string | null = null

interface TagChipProps {
  tag: string | null
  activeTag: string | null
  query: string
  /** Clicking the active chip clears the filter, back to /blog. */
  toggles?: boolean
  className?: string
}

/**
 * Links keep the scroll position: the page above the row is the same on every
 * listing, so the row stays put and only the posts below change.
 */
function TagChip({
  tag,
  activeTag,
  query,
  toggles = false,
  className,
}: TagChipProps) {
  const active = tag === activeTag
  const clears = toggles && active
  const pathname = tag === null || clears ? '/blog' : tagPath(tag)

  return (
    <Link
      href={query.trim() ? { pathname, query: { q: query } } : pathname}
      scroll={false}
      aria-current={active && !clears ? 'page' : undefined}
      className={twMerge(
        chipClassName,
        className,
        active && activeChipClassName,
        clears && 'flex items-center gap-1',
      )}
    >
      {tag ?? 'All'}
      {clears && (
        <>
          <X className="h-3 w-3" aria-hidden />
          <span className="sr-only">, clear filter</span>
        </>
      )}
    </Link>
  )
}

/**
 * "All", the most used tags, and a "More" popover with the rest, A to Z. On a
 * tag from the popover, "More" takes that tag's name and keeps it while other
 * tags are picked from the row, until "All". Every entry is a link to a
 * prerendered listing, and the popover's panel stays in the HTML while closed,
 * so crawlers reach every tag page from here.
 */
export default function BlogTagRow({
  tags,
  activeTag,
  query,
  className,
}: BlogTagRowProps) {
  const { rowTags, moreTags } = splitTags(tags)
  const activeInMore = activeTag !== null && moreTags.includes(activeTag)
  const [rememberedTag] = useState(() => lastMoreTag)
  let moreLabel = activeTag === null ? null : rememberedTag

  if (activeInMore) {
    moreLabel = activeTag
  }

  useEffect(() => {
    if (activeTag === null) {
      lastMoreTag = null
    } else if (activeInMore) {
      lastMoreTag = activeTag
    }
  }, [activeInMore, activeTag])

  return (
    <nav
      aria-label="Browse by tag"
      className={twMerge('relative flex min-w-0 flex-wrap gap-1', className)}
    >
      <TagChip tag={null} activeTag={activeTag} query={query} />

      {rowTags.map((tag) => (
        <TagChip key={tag} tag={tag} activeTag={activeTag} query={query} />
      ))}

      {moreTags.length > 0 && (
        // From `lg` the panel centers under this button; on smaller screens,
        // where it could run off the edge, it spans the row instead.
        <Popover className="lg:relative">
          {({ open }) => (
            <>
              <Popover.Button
                className={twMerge(
                  chipClassName,
                  'flex items-center gap-1 focus:outline-none focus-visible:border-white focus-visible:border-opacity-30',
                  open && 'border-white border-opacity-30 text-opacity-100',
                  activeInMore && activeChipClassName,
                )}
              >
                {moreLabel ? (
                  <>
                    <span className="sr-only">More tags: </span>
                    {moreLabel}
                  </>
                ) : (
                  'More'
                )}
                <ChevronDown
                  className={twMerge(
                    'h-3.5 w-3.5 motion-safe:transition-transform',
                    open && 'rotate-180',
                  )}
                  aria-hidden
                />
              </Popover.Button>

              <Popover.Panel
                unmount={false}
                className="absolute left-0 right-0 top-full z-20 mt-2 lg:left-1/2 lg:right-auto lg:w-[40rem] lg:-translate-x-1/2"
              >
                {/* Styled apart from the panel, whose transform positions it,
                    so the open animation can use its own. */}
                <div className="origin-top overflow-hidden rounded-2xl border border-white/15 bg-paper bg-gradient-to-b from-brand-main/[0.08] to-transparent shadow-[0_20px_50px_rgba(0,0,0,0.75)] ring-1 ring-brand-main/10 motion-safe:animate-popover-in">
                  <div className="flex max-h-[60vh] flex-wrap justify-center gap-1.5 overflow-y-auto overscroll-contain p-4">
                    {moreTags.map((tag) => (
                      <TagChip
                        key={tag}
                        tag={tag}
                        activeTag={activeTag}
                        query={query}
                        toggles
                        className="border-white/10 bg-white/[0.04] px-2 py-0.5 hover:bg-white/[0.08]"
                      />
                    ))}
                  </div>
                </div>
              </Popover.Panel>
            </>
          )}
        </Popover>
      )}
    </nav>
  )
}
