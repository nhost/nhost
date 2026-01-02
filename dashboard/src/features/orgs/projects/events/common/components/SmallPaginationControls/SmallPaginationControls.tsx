import { Button } from '@/components/ui/v3/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationControlsProps {
  offset: number;
  limit: number;
  hasNoPreviousPage: boolean;
  hasNoNextPage: boolean;
  onPrev: () => void;
  onNext: () => void;
  onChangeLimit: (value: number) => void;
  className?: string;
}

export default function SmallPaginationControls({
  offset,
  limit,
  hasNoPreviousPage,
  hasNoNextPage,
  onPrev,
  onNext,
  onChangeLimit,
  className,
}: PaginationControlsProps) {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-end gap-4 py-4 pl-6 pr-6',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Rows per page:</span>
        <Select
          defaultValue={String(limit)}
          onValueChange={(value) => onChangeLimit(parseInt(value, 10))}
        >
          <SelectTrigger className="w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5</SelectItem>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="75">75</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid h-9 grid-flow-col items-center justify-around rounded-md border-1 px-1">
        <Button
          variant="outline"
          size="icon"
          disabled={hasNoPreviousPage}
          onClick={onPrev}
          aria-label="Previous page"
          className="h-max w-max border-none bg-transparent dark:hover:bg-[#2f363d]"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="mx-1 inline-block font-display text-sm+ font-medium text-muted-foreground">
          {offset} - {offset + limit}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={hasNoNextPage}
          onClick={onNext}
          aria-label="Next page"
          className="h-max w-max border-none bg-transparent dark:hover:bg-[#2f363d]"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
