import { Button, type ButtonProps } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface DataGridPaginationProps {
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
  nextButtonProps?: ButtonProps;
  /**
   * Props to be passed to the previous button component.
   */
  prevButtonProps?: ButtonProps;
  className?: string;
}

export default function DataGridPagination({
  className,
  totalPages,
  currentPage,
  onOpenPrevPage,
  onOpenNextPage,
  nextButtonProps,
  prevButtonProps,
}: DataGridPaginationProps) {
  return (
    <div
      className={cn(
        'grid grid-flow-col items-center justify-around rounded-md border-1 px-1',
        className,
      )}
    >
      <Button
        variant="outline"
        size="icon"
        disabled={currentPage === 1}
        onClick={onOpenPrevPage}
        aria-label="Previous page"
        className="h-max w-max border-none bg-transparent dark:hover:bg-[#2f363d]"
        {...prevButtonProps}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span
        className={cn(
          'mx-1 inline-block font-display font-medium',
          currentPage > 99 ? 'text-xs' : 'text-sm+',
        )}
      >
        {currentPage}
        <span className="mx-1 inline-block text-disabled">/</span>
        {totalPages}
      </span>

      <Button
        variant="outline"
        size="icon"
        disabled={currentPage === totalPages}
        onClick={onOpenNextPage}
        aria-label="Next page"
        className="h-max w-max border-none bg-transparent dark:hover:bg-[#2f363d]"
        {...nextButtonProps}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
