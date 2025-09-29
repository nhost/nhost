import type { DataBrowserGridColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { DataGridHeaderButton } from '@/features/orgs/projects/storage/dataGrid/components/DataGridHeaderButton';
import { cn } from '@/lib/utils';
import { useTheme } from '@mui/material';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

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
  const theme = useTheme();
  return (
    <div
      className={twMerge(
        'sticky top-0 z-30 inline-flex w-full items-center',
        className,
      )}
      {...props}
    >
      {flatHeaders.map((column: DataBrowserGridColumn) => {
        const sortByProps = column.getSortByToggleProps();
        const headerProps = column.getHeaderProps({
          style: { display: 'inline-flex' },
          ...sortByProps,
        });

        return (
          <div
            className={cn(
              'group relative inline-flex self-stretch overflow-hidden font-display text-xs font-bold focus:outline-none focus-visible:outline-none',
              'border-b-1 border-r-1',
              { 'sticky left-0 max-w-2': column.id === 'selection-column' },
              'dark:text-[#dfecf5]',
            )}
            style={{
              ...headerProps.style,
              backgroundColor: column.isDisabled
                ? theme.palette.background.default
                : theme.palette.background.paper,
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
