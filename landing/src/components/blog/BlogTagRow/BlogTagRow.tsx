import { tagPath, TAG_ROW_SIZE } from '@/lib/blogGrouping'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

export interface BlogTagRowProps {
  /** Popular tags, most used first. */
  tags: string[]
  /** The tag whose listing this is, or `null` on /blog. */
  activeTag: string | null
}

const chipClassName =
  'block whitespace-nowrap rounded-full border border-divider px-3 py-1 text-xs text-white text-opacity-65 hover:border-white hover:border-opacity-40 hover:text-opacity-100 hover:no-underline motion-safe:transition-colors'

const activeChipClassName =
  'border-white bg-white text-black text-opacity-100 hover:border-white'

/**
 * "All", the most used tags, and a "More" menu with the rest. Every entry is a
 * link to a prerendered listing, and `<details>` keeps the menu's links in the
 * HTML when closed, so crawlers reach every tag page from here.
 */
export default function BlogTagRow({ tags, activeTag }: BlogTagRowProps) {
  const rowTags = tags.slice(0, TAG_ROW_SIZE)
  const moreTags = tags.slice(TAG_ROW_SIZE)
  const activeInMore = activeTag !== null && moreTags.includes(activeTag)

  return (
    <nav aria-label="Browse by tag" className="flex min-w-0 items-center gap-2">
      <div className="min-w-0 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex w-max gap-2">
          <li>
            <Link
              href="/blog"
              aria-current={activeTag === null ? 'page' : undefined}
              className={twMerge(
                chipClassName,
                activeTag === null && activeChipClassName,
              )}
            >
              All
            </Link>
          </li>
          {rowTags.map((tag) => (
            <li key={tag}>
              <Link
                href={tagPath(tag)}
                aria-current={tag === activeTag ? 'page' : undefined}
                className={twMerge(
                  chipClassName,
                  tag === activeTag && activeChipClassName,
                )}
              >
                {tag}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {moreTags.length > 0 && (
        // Keyed by the active tag so the menu closes after picking from it:
        // tag pages share one route, so the page itself stays mounted.
        <details key={activeTag ?? 'all'} className="group relative shrink-0">
          <summary
            className={twMerge(
              chipClassName,
              'flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden',
              activeInMore && activeChipClassName,
            )}
          >
            {activeInMore ? activeTag : 'More'}
            <ChevronDown
              className="h-3 w-3 group-open:rotate-180 motion-safe:transition-transform"
              aria-hidden
            />
          </summary>

          <ul className="absolute right-0 z-20 mt-2 grid max-h-72 min-w-[10rem] grid-flow-row overflow-y-auto rounded-xl border border-divider bg-black p-1 shadow-lg">
            {moreTags.map((tag) => (
              <li key={tag}>
                <Link
                  href={tagPath(tag)}
                  aria-current={tag === activeTag ? 'page' : undefined}
                  className={twMerge(
                    'block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-white text-opacity-65 hover:bg-white hover:bg-opacity-10 hover:text-opacity-100 hover:no-underline',
                    tag === activeTag && 'text-opacity-100',
                  )}
                >
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </nav>
  )
}
