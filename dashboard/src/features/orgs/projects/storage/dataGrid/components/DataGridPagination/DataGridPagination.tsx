import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import type { IconButtonProps } from '@/components/ui/v2/IconButton';
import { IconButton } from '@/components/ui/v2/IconButton';
import { ChevronLeftIcon } from '@/components/ui/v2/icons/ChevronLeftIcon';
import { ChevronRightIcon } from '@/components/ui/v2/icons/ChevronRightIcon';
import { Text } from '@/components/ui/v2/Text';
import clsx from 'clsx';

export interface DataGridPaginationProps extends BoxProps {
  /**
   * Number of pages.
   */
  totalPages: number;
  /**
   * Current page.
   */
  currentPage: number;
  /**
   * Function to be called when navigating to the previous page.
   */
  onOpenPrevPage: VoidFunction;
  /**
   * Function to be called when navigating to the next page.
   */
  onOpenNextPage: VoidFunction;
  /**
   * Props to be passed to the next button component.
   */
  nextButtonProps?: IconButtonProps;
  /**
   * Props to be passed to the previous button component.
   */
  prevButtonProps?: IconButtonProps;
}

export default function DataGridPagination({
  className,
  totalPages,
  currentPage,
  onOpenPrevPage,
  onOpenNextPage,
  nextButtonProps,
  prevButtonProps,
  ...props
}: DataGridPaginationProps) {
  return (
    <Box
      className={clsx(
        'grid grid-flow-col items-center justify-around rounded-md border-1',
        className,
      )}
      {...props}
    >
      <IconButton
        variant="borderless"
        color="secondary"
        disabled={currentPage === 1}
        onClick={onOpenPrevPage}
        aria-label="Previous page"
        {...prevButtonProps}
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </IconButton>

      <span
        className={clsx(
          'mx-1 inline-block font-display font-medium',
          currentPage > 99 ? 'text-xs' : 'text-sm+',
        )}
      >
        {currentPage}
        <Text component="span" className="mx-1 inline-block" color="disabled">
          /
        </Text>
        {totalPages}
      </span>

      <IconButton
        variant="borderless"
        color="secondary"
        disabled={currentPage === totalPages}
        onClick={onOpenNextPage}
        aria-label="Next page"
        {...nextButtonProps}
      >
        <ChevronRightIcon className="h-4 w-4" />
      </IconButton>
    </Box>
  );
}
