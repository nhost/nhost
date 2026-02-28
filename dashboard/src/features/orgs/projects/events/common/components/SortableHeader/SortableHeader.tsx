import type { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';

export default function SortableHeader<TData, TValue>({
  column,
  label,
}: {
  column: Column<TData, TValue>;
  label: string;
}) {
  const sortedState = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      className={cn(
        'h-fit w-full p-0 font-bold font-display text-primary-text text-xs focus:outline-none motion-safe:transition-colors dark:hover:bg-[#21262d]',
      )}
      onClick={column.getToggleSortingHandler()}
      disabled={!column.getCanSort()}
    >
      <div className="!flex relative h-full w-full grid-flow-col items-center justify-between p-2">
        <span className="truncate">{label}</span>
        <span>
          {sortedState === 'asc' && <ArrowUp className="h-3 w-3" />}
          {sortedState === 'desc' && <ArrowDown className="h-3 w-3" />}
        </span>
      </div>
    </Button>
  );
}
