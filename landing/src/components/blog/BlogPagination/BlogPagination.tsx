import { getPageNumbers, listingPath } from '@/lib/blogGrouping'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

export interface BlogPaginationProps {
  /** The listing's page 1, e.g. `/blog` or `/blog/tag/auth`. */
  basePath: string
  page: number
  totalPages: number
}

const itemClassName =
  'flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-sm tabular-nums text-white text-opacity-65 hover:bg-white hover:bg-opacity-10 hover:text-opacity-100 hover:no-underline'

/**
 * Arrows around numbered page links, centered. Plain links, so crawlers and
 * visitors without JavaScript can walk the whole listing.
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
      className="flex items-center justify-center gap-1 border-t border-divider pt-6"
    >
      {page > 1 ? (
        <Link
          href={listingPath(basePath, page - 1)}
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

      <ol className="flex items-center gap-1">
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
                  'bg-white text-black text-opacity-100 hover:bg-white',
                )}
              >
                {number}
              </span>
            )}

            {number !== null && number !== page && (
              <Link
                href={listingPath(basePath, number)}
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
