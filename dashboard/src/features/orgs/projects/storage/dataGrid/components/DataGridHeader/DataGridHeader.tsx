import type { Header } from '@tanstack/react-table';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import type { UnknownDataGridRow } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { SELECTION_COLUMN_ID } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/useDataGrid';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { DataGridHeaderButton } from '@/features/orgs/projects/storage/dataGrid/components/DataGridHeaderButton';
import { cn } from '@/lib/utils';

export interface HeaderActionProps
  extends DetailedHTMLProps<HTMLProps<HTMLElement>, HTMLElement> {}

export interface DataGridHeaderProps
  extends Omit<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
    'children'
  > {}

export default function DataGridHeader({
  className,
  ...props
}: DataGridHeaderProps) {
  const { getFlatHeaders } = useDataGridConfig();

  return (
    <div
      className={cn(
        'sticky top-0 z-30 inline-flex w-full items-center',
        className,
      )}
      {...props}
    >
      {getFlatHeaders().map((header: Header<UnknownDataGridRow, unknown>) => {
        const column = header.column;
        const width = header.getSize();
        const maxSize = column.columnDef.maxSize;

        return (
          <div
            className={cn(
              'group relative inline-flex self-stretch overflow-hidden font-bold font-display text-xs focus:outline-none focus-visible:outline-none',
              'border-r-1 border-b-1',
              'bg-paper',
              { 'sticky left-0 max-w-2': column.id === SELECTION_COLUMN_ID },
            )}
            style={{
              width,
              minWidth: width,
              maxWidth: column.id === SELECTION_COLUMN_ID ? 32 : maxSize,
              zIndex: column.id === SELECTION_COLUMN_ID ? 10 : undefined,
            }}
            key={header.id}
          >
            <DataGridHeaderButton header={header} />
          </div>
        );
      })}
    </div>
  );
}
