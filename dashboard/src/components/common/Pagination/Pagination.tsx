import type { ButtonProps } from '@/ui/v2/Button';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import ChevronLeftIcon from '@/ui/v2/icons/ChevronLeftIcon';
import ChevronRightIcon from '@/ui/v2/icons/ChevronRightIcon';
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
  ...props
}: PaginationProps) {
  return (
    <div
      className={twMerge('grid grid-flow-col items-center gap-2', className)}
      {...props}
    >
      <div className="grid justify-start grid-flow-col gap-2">
        <Button
          variant="outlined"
          color="secondary"
          className="block text-xs"
          disabled={currentPageNumber === 1}
          aria-label="Previous page"
          onClick={onPrevPageClick}
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back
        </Button>

        <div className="grid grid-cols-3 gap-1 text-center grid-col">
          <Text className="self-center text-xs align-middle text-greyscaleGreyDark w-">
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
            componentsProps={{
              formControl: {
                className: 'flex flex-row-reverse text-center',
              },
              inputRoot: {
                className: 'px-12',
              },
            }}
            slotProps={{
              root: {
                className: twMerge(
                  'w-9 h-8 text-center px-0.5',
                  currentPageNumber > 9 ? 'px-0' : 'px-0.5',
                ),
              },
              input: {
                style: {
                  fontSize: '0.70rem',
                },
              },
            }}
          />
          <Text className="self-center text-xs align-middle text-greyscaleGreyDark">
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
          {...slotProps?.nextButton}
        >
          Next
          <ChevronRightIcon className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-row items-center justify-end text-center gap-x-1">
        <Text className="text-xs text-greyscaleGreyDark">
          {currentPageNumber === 1 && currentPageNumber}
          {currentPageNumber === 2 && elementsPerPage + currentPageNumber - 1}
          {currentPageNumber > 2 &&
            (currentPageNumber - 1) * elementsPerPage + 1}{' '}
          -{' '}
          {totalNrOfElements < currentPageNumber * elementsPerPage
            ? totalNrOfElements
            : currentPageNumber * elementsPerPage}{' '}
          of {totalNrOfElements} users
        </Text>
      </div>
    </div>
  );
}
