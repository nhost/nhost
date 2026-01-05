import { Button } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';
import type { Column } from '@tanstack/react-table';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function CreatedAtHeader<TData, TValue>({
  column,
}: {
  column: Column<TData, TValue>;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting()}
      className="flex items-center justify-between gap-2"
    >
      <span>Created At</span>
      <span className="flex flex-col">
        <ChevronUp
          className={cn(
            '-mb-0.5 h-4 w-4',
            column.getIsSorted() === 'asc'
              ? 'text-accent-foreground'
              : 'text-muted-foreground',
          )}
        />
        <ChevronDown
          className={cn(
            '-mt-0.5 h-4 w-4',
            column.getIsSorted() === 'desc'
              ? 'text-accent-foreground'
              : 'text-muted-foreground',
          )}
        />
      </span>
    </Button>
  );
}
