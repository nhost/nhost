import { listingPath } from '@/lib/blogGrouping'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export interface BlogPaginationProps {
  /** The listing's page 1, e.g. `/blog` or `/blog/tag/auth`. */
  basePath: string
  page: number
  totalPages: number
}

const linkClassName =
  'inline-flex items-center gap-1.5 text-sm text-white text-opacity-65 hover:text-opacity-100'

/**
 * Plain links to the previous and next pages, so crawlers and visitors without
 * JavaScript can walk the whole listing.
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
      className="grid grid-cols-3 items-center text-sm"
    >
      <span>
        {page > 1 && (
          <Link
            href={listingPath(basePath, page - 1)}
            rel="prev"
            className={linkClassName}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Newer
          </Link>
        )}
      </span>

      <span className="text-center text-white text-opacity-50">
        Page {page} of {totalPages}
      </span>

      <span className="text-right">
        {page < totalPages && (
          <Link
            href={listingPath(basePath, page + 1)}
            rel="next"
            className={linkClassName}
          >
            Older
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </span>
    </nav>
  )
}
