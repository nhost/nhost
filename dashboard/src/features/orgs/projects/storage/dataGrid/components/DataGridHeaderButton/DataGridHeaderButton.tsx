import { flexRender, type Header } from '@tanstack/react-table';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import type { UnknownDataGridRow } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { SELECTION_COLUMN_ID } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/useDataGrid';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { cn } from '@/lib/utils';

interface DataGridHeaderButtonProps<TData, TValue> {
  header: Header<TData, TValue>;
}

export default function DataGridHeaderButton<
  TData extends UnknownDataGridRow,
  TValue,
>({ header }: DataGridHeaderButtonProps<TData, TValue>) {
  const { allowSort, allowResize } = useDataGridConfig();
  const column = header.column;

  const canSort = column.getCanSort();
  const isSorted = column.getIsSorted();
  const canResize = column.getCanResize();

  if (column.id === SELECTION_COLUMN_ID) {
    return (
      <span className="!inline-flex h-8 w-8 items-center justify-center">
        {flexRender(column.columnDef.header, header.getContext())}
      </span>
    );
  }

  if (column.id === 'preview-column') {
    return flexRender(column.columnDef.header, header.getContext());
  }

  return (
    <div className="flex w-full items-start justify-center">
      <Button
        role="columnheader"
        variant="ghost"
        className={cn(
          'h-fit w-full rounded-none p-0 text-xs focus:outline-none motion-safe:transition-colors dark:hover:bg-[#21262d]',
        )}
        disabled={!canSort}
        onClick={column.getToggleSortingHandler()}
      >
        <div className="!flex relative h-full w-full grid-flow-col items-center justify-between p-2">
          {flexRender(column.columnDef.header, header.getContext())}
          {allowSort && canSort && (
            <span>
              {isSorted === 'asc' && <ArrowUp className="h-3 w-3" />}

              {isSorted === 'desc' && <ArrowDown className="h-3 w-3" />}
            </span>
          )}
        </div>
      </Button>

      {allowResize && canResize && (
        <button
          type="button"
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onClick={(event) => event.stopPropagation()}
          className="absolute top-0 -right-0.5 bottom-0 z-10 h-full w-2 cursor-col-resize rounded-none group-hover:bg-slate-900 group-hover:bg-opacity-20 group-active:bg-slate-900 group-active:bg-opacity-20 motion-safe:transition-colors"
        />
      )}
    </div>
  );
}
