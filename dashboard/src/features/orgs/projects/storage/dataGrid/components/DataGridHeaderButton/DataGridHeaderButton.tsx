import { Button } from '@/components/ui/v3/button';
import type { DataBrowserGridColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { TableHeaderProps } from 'react-table';

interface DataGridHeaderButtonProps<T extends object> {
  column: DataBrowserGridColumn<T>;
  headerProps: TableHeaderProps;
}

export default function DataGridHeaderButton<T extends object>({
  column,
  headerProps,
}: DataGridHeaderButtonProps<T>) {
  const { allowSort, allowResize } = useDataGridConfig();

  if (column.id === 'selection-column') {
    return (
      <span
        {...headerProps}
        className="!inline-flex h-8 w-8 items-center justify-center"
      >
        {column.render('Header')}
      </span>
    );
  }

  if (column.id === 'preview-column') {
    return (
      <div className="focus:outline-none motion-safe:transition-colors">
        {column.render('Header')}
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      className={cn(
        'h-fit p-0 text-xs focus:outline-none motion-safe:transition-colors dark:hover:bg-[#21262d]',
      )}
      disabled={column.isDisabled || column.disableSortBy}
    >
      <div
        {...headerProps}
        className="relative !flex h-full w-full grid-flow-col items-center justify-between p-2"
      >
        {column.render('Header')}
        {allowSort && (
          <span>
            {column.isSorted && !column.isSortedDesc && (
              <ArrowUp className="h-3 w-3" />
            )}

            {column.isSorted && column.isSortedDesc && (
              <ArrowDown className="h-3 w-3" />
            )}
          </span>
        )}
      </div>
      {allowResize && !column.disableResizing && (
        <span
          {...column.getResizerProps({
            onClick: (event: Event) => event.stopPropagation(),
          })}
          className="absolute -right-0.5 bottom-0 top-0 z-10 h-full w-1.5 group-hover:bg-slate-900 group-hover:bg-opacity-20 group-active:bg-slate-900 group-active:bg-opacity-20 motion-safe:transition-colors"
        />
      )}
    </Button>
  );
}
