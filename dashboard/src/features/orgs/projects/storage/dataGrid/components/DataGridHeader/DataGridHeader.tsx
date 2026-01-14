import type { DataBrowserGridColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { DataGridHeaderButton } from '@/features/orgs/projects/storage/dataGrid/components/DataGridHeaderButton';
import { cn } from '@/lib/utils';
import type { DetailedHTMLProps, HTMLProps } from 'react';

export interface HeaderActionProps
  extends DetailedHTMLProps<HTMLProps<HTMLElement>, HTMLElement> {}

export interface DataGridHeaderProps
  extends Omit<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
    'children'
  > {}

// TODO: Get rid of Data Browser related code from here. This component should
// be generic and not depend on Data Browser related data types and logic.
export default function DataGridHeader({
  className,
  ...props
}: DataGridHeaderProps) {
  const { flatHeaders } = useDataGridConfig();

  return (
    <div
      className={cn(
        'sticky top-0 z-30 inline-flex w-full items-center',
        className,
      )}
      {...props}
    >
      {flatHeaders
        .filter(({ isVisible }) => isVisible)
        .map((column: DataBrowserGridColumn) => {
          const sortByProps = column.getSortByToggleProps();
          const headerProps = column.getHeaderProps({
            style: { display: 'inline-flex' },
            ...sortByProps,
          });

          return (
            <div
              className={cn(
                'group relative inline-flex self-stretch overflow-hidden font-bold font-display text-xs focus:outline-none focus-visible:outline-none',
                'border-r-1 border-b-1',
                'bg-paper',
                { 'sticky left-0 max-w-2': column.id === 'selection-column' },
              )}
              style={{
                ...headerProps.style,
                maxWidth:
                  column.id === 'selection-column'
                    ? 32
                    : headerProps.style?.maxWidth,
                width:
                  column.id === 'selection-column'
                    ? '100%'
                    : headerProps.style?.width,
                zIndex:
                  column.id === 'selection-column'
                    ? 10
                    : headerProps.style?.zIndex,
                position: undefined,
              }}
              key={column.id}
            >
              <DataGridHeaderButton column={column} headerProps={headerProps} />
            </div>
          );
        })}
    </div>
  );
}
