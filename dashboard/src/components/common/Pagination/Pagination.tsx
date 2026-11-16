import type { DetailedHTMLProps, HTMLProps } from 'react';
import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Pagination as PaginationRoot,
} from '@/components/ui/v3/pagination';
import { cn } from '@/lib/utils';

export type PaginationProps = DetailedHTMLProps<
  HTMLProps<HTMLDivElement>,
  HTMLDivElement
> & {
  /**
   * Total number of pages.
   */
  totalNrOfPages: number;
  /**
   * Number of total elements per page.
   */
  elementsPerPage: number;
  /**
   * Total number of elements.
   */
  totalNrOfElements: number;
  /**
   * Label of the elements displayed ex: pages, users...
   */
  itemsLabel: string;
  /**
   * Current page number.
   */
  currentPageNumber: number;
  /**
   * Function to be called when navigating to the previous page.
   */
  onPrevPageClick: VoidFunction;
  /**
   * Function to be called when navigating to the next page.
   */
  onNextPageClick: VoidFunction;
  /**
   * Function to be called when a new page number is selected.
   */
  onPageChange: (page: number) => void;
};

const SIBLING_COUNT = 1;

function range(start: number, end: number): number[] {
  return Array.from(
    { length: Math.max(end - start + 1, 0) },
    (_, i) => start + i,
  );
}

function getPageItems(
  currentPage: number,
  totalPages: number,
): (number | 'ellipsis')[] {
  const totalPageNumbers = SIBLING_COUNT * 2 + 5;

  if (totalPages <= totalPageNumbers) {
    return range(1, totalPages);
  }

  const leftSibling = Math.max(currentPage - SIBLING_COUNT, 1);
  const rightSibling = Math.min(currentPage + SIBLING_COUNT, totalPages);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    return [...range(1, 3 + 2 * SIBLING_COUNT), 'ellipsis', totalPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    return [
      1,
      'ellipsis',
      ...range(totalPages - (2 + 2 * SIBLING_COUNT), totalPages),
    ];
  }

  return [
    1,
    'ellipsis',
    ...range(leftSibling, rightSibling),
    'ellipsis',
    totalPages,
  ];
}

export default function Pagination({
  className,
  totalNrOfPages,
  currentPageNumber,
  onPrevPageClick,
  onNextPageClick,
  elementsPerPage,
  onPageChange,
  totalNrOfElements,
  itemsLabel,
  ...props
}: PaginationProps) {
  const pageItems = getPageItems(currentPageNumber, totalNrOfPages);
  const rangeStart = (currentPageNumber - 1) * elementsPerPage + 1;
  const rangeEnd = Math.min(
    currentPageNumber * elementsPerPage,
    totalNrOfElements,
  );

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2',
        className,
      )}
      {...props}
    >
      <PaginationRoot className="mx-0 w-auto justify-start">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              aria-label="Previous page"
              disabled={currentPageNumber === 1}
              onClick={onPrevPageClick}
            />
          </PaginationItem>

          {pageItems.map((item, index) =>
            item === 'ellipsis' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: ellipsis position is stable within a render
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink
                  aria-label={`Go to page ${item}`}
                  isActive={item === currentPageNumber}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationNext
              aria-label="Next page"
              disabled={currentPageNumber === totalNrOfPages}
              onClick={onNextPageClick}
            />
          </PaginationItem>
        </PaginationContent>
      </PaginationRoot>

      <span className="text-muted-foreground text-xs">
        {rangeStart} - {rangeEnd} of {totalNrOfElements} {itemsLabel}
      </span>
    </div>
  );
}
