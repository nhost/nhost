import { Box } from '@/components/ui/v2/Box';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { ArrowDownIcon } from '@/components/ui/v2/icons/ArrowDownIcon';
import { ArrowUpIcon } from '@/components/ui/v2/icons/ArrowUpIcon';
import type { DataBrowserGridColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import type { TableHeaderProps } from 'react-table';
import { twMerge } from 'tailwind-merge';

interface DataGridHeaderButtonProps<T extends object> {
  column: DataBrowserGridColumn<T>;
  headerProps: TableHeaderProps;
  onRemoveColumn: (column: DataBrowserGridColumn<T>) => void;
}

export default function DataGridHeaderButton<T extends object>({
  column,
  headerProps,
  onRemoveColumn,
}: DataGridHeaderButtonProps<T>) {
  const { allowSort, allowResize } = useDataGridConfig();

  if (column.id === 'selection') {
    return (
      <span
        {...headerProps}
        className="relative grid w-full grid-flow-col items-center justify-between p-2"
      >
        {column.render('Header')}
      </span>
    );
  }

  if (column.id === 'preview') {
    return (
      <div className="focus:outline-none motion-safe:transition-colors">
        {column.render('Header')}
      </div>
    );
  }

  return (
    <Dropdown.Trigger
      className={twMerge('focus:outline-none motion-safe:transition-colors')}
      disabled={column.isDisabled || (column.disableSortBy && !onRemoveColumn)}
      hideChevron
    >
      <span
        {...headerProps}
        className="relative grid w-full grid-flow-col items-center justify-between p-2"
      >
        {column.render('Header')}

        {allowSort && (
          <Box component="span" sx={{ color: 'text.primary' }}>
            {column.isSorted && !column.isSortedDesc && (
              <ArrowUpIcon className="h-3 w-3" />
            )}

            {column.isSorted && column.isSortedDesc && (
              <ArrowDownIcon className="h-3 w-3" />
            )}
          </Box>
        )}
      </span>

      {allowResize && !column.disableResizing && (
        <span
          {...column.getResizerProps({
            onClick: (event: Event) => event.stopPropagation(),
          })}
          className="absolute -right-0.5 bottom-0 top-0 z-10 h-full w-1.5 group-hover:bg-slate-900 group-hover:bg-opacity-20 group-active:bg-slate-900 group-active:bg-opacity-20 motion-safe:transition-colors"
        />
      )}
    </Dropdown.Trigger>
  );
}
