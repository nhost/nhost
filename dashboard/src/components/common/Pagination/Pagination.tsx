import type { ButtonProps } from '@/components/ui/v2/Button';
import { Button } from '@/components/ui/v2/Button';
import { ChevronLeftIcon } from '@/components/ui/v2/icons/ChevronLeftIcon';
import { ChevronRightIcon } from '@/components/ui/v2/icons/ChevronRightIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

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
  elementsPerPage?: number;
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
   * Function to be called when a new page number is submitted.
   */
  onPageChange: (page: number) => void;
  /**
   * Props for component slots.
   */
  slotProps?: {
    /**
     * Props to be passed to the next button component.
     */
    nextButton?: Partial<ButtonProps>;
    /**
     * Props to be passed to the previous button component.
     */
    prevButton?: Partial<ButtonProps>;
  };
};

export default function Pagination({
  className,
  totalNrOfPages,
  currentPageNumber,
  onPrevPageClick,
  onNextPageClick,
  slotProps,
  elementsPerPage,
  onPageChange,
  totalNrOfElements,
  itemsLabel,
  ...props
}: PaginationProps) {
  return (
    <div
      className={twMerge('grid grid-flow-col items-center gap-2', className)}
      {...props}
    >
      <div className="grid grid-flow-col justify-start gap-2">
        <Button
          variant="outlined"
          color="secondary"
          className="text-xs"
          disabled={currentPageNumber === 1}
          aria-label="Previous page"
          onClick={onPrevPageClick}
          startIcon={<ChevronLeftIcon className="h-4 w-4" />}
        >
          Back
        </Button>

        <div className="grid-col grid grid-cols-3 items-center gap-1 text-center">
          <Text className="align-middle text-xs" color="secondary">
            Page
          </Text>
          <Input
            value={currentPageNumber}
            onChange={(e) => {
              const page = parseInt(e.target.value, 10);
              if (page > 0 && page <= totalNrOfPages) {
                onPageChange(page);
              }
            }}
            disabled={totalNrOfPages === 1}
            color="secondary"
            slotProps={{
              inputRoot: {
                className: 'w-4 h-2.5 text-center !text-[11.5px]',
              },
            }}
          />
          <Text className="self-center align-middle text-xs" color="secondary">
            of {totalNrOfPages}
          </Text>
        </div>

        <Button
          variant="outlined"
          color="secondary"
          className="text-xs"
          aria-label="Next page"
          disabled={currentPageNumber === totalNrOfPages}
          onClick={onNextPageClick}
          endIcon={<ChevronRightIcon className="h-4 w-4" />}
          {...slotProps?.nextButton}
        >
          Next
        </Button>
      </div>
      <div className="flex flex-row items-center justify-end gap-x-1 text-center">
        <Text className="text-xs" color="secondary">
          {currentPageNumber === 1 && currentPageNumber}
          {currentPageNumber === 2 && elementsPerPage + currentPageNumber - 1}
          {currentPageNumber > 2 &&
            (currentPageNumber - 1) * elementsPerPage + 1}{' '}
          -{' '}
          {totalNrOfElements < currentPageNumber * elementsPerPage
            ? totalNrOfElements
            : currentPageNumber * elementsPerPage}{' '}
          of {totalNrOfElements} {itemsLabel}
        </Text>
      </div>
    </div>
  );
}
