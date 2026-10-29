import { getPageNumbers, listingPath } from '@/lib/blogGrouping'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { MouseEvent } from 'react'
import { twMerge } from 'tailwind-merge'

export interface BlogPaginationProps {
  /** The listing's page 1, e.g. `/blog` or `/blog/tag/auth`. */
  basePath: string
  page: number
  totalPages: number
}

const itemClassName =
  'flex h-7 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-sm tabular-nums text-white text-opacity-65 hover:bg-white hover:bg-opacity-10 hover:text-opacity-100 hover:no-underline sm:h-8 sm:min-w-[2rem] sm:px-2'

/**
 * Path of the page link last clicked, so only the listing it opens glides.
 * Back and forward never set it, and the next listing to mount clears it, so a
 * cancelled navigation can't make some other listing glide.
 */
let glidePath: string | null = null

function handlePageClick(event: MouseEvent<HTMLAnchorElement>) {
  const modified =
    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey

  glidePath = modified ? null : event.currentTarget.pathname
}

/** Whether the listing just mounted from a page link click. Resets it. */
export function takePageGlide(): boolean {
  const glide = glidePath === window.location.pathname
  glidePath = null

  return glide
}

/**
 * Arrows around numbered page links, centered. Plain links, so crawlers and
 * visitors without JavaScript can walk the whole listing, landing at the top.
 * With JavaScript, links keep the scroll position and the listing glides to
 * its posts after a page click; see `takePageGlide`.
 */
export default function BlogPagination({
  basePath,
  page,
  totalPages,
}: BlogPaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-0.5 border-t border-divider pt-6 sm:gap-1"
    >
      {page > 1 ? (
        <Link
          href={listingPath(basePath, page - 1)}
          scroll={false}
          onClick={handlePageClick}
          rel="prev"
          aria-label="Previous page"
          className={itemClassName}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <span
          aria-hidden
          className={twMerge(itemClassName, 'opacity-30 hover:bg-transparent')}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </span>
      )}

      <ol className="flex items-center gap-0.5 sm:gap-1">
        {getPageNumbers(page, totalPages).map((number, index) => (
          <li key={number ?? `gap-${index}`}>
            {number === null && (
              <span className="px-1 text-sm text-white text-opacity-40">…</span>
            )}

            {number !== null && number === page && (
              <span
                aria-current="page"
                className={twMerge(
                  itemClassName,
                  'bg-white text-black text-opacity-100 hover:bg-white hover:bg-opacity-100',
                )}
              >
                {number}
              </span>
            )}

            {number !== null && number !== page && (
              <Link
                href={listingPath(basePath, number)}
                scroll={false}
                onClick={handlePageClick}
                aria-label={`Page ${number}`}
                className={itemClassName}
              >
                {number}
              </Link>
            )}
          </li>
        ))}
      </ol>

      {page < totalPages ? (
        <Link
          href={listingPath(basePath, page + 1)}
          scroll={false}
          onClick={handlePageClick}
          rel="next"
          aria-label="Next page"
          className={itemClassName}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <span
          aria-hidden
          className={twMerge(itemClassName, 'opacity-30 hover:bg-transparent')}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
      )}
    </nav>
  )
}
