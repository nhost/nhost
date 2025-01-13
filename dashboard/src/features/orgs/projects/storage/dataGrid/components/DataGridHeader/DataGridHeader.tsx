import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { ArrowDownIcon } from '@/components/ui/v2/icons/ArrowDownIcon';
import { ArrowUpIcon } from '@/components/ui/v2/icons/ArrowUpIcon';
import { PencilIcon } from '@/components/ui/v2/icons/PencilIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import type { DataBrowserGridColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { DataGridProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { DataGridHeaderButton } from '@/features/orgs/projects/storage/dataGrid/components/DataGridHeaderButton';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

export interface HeaderActionProps
  extends DetailedHTMLProps<HTMLProps<HTMLElement>, HTMLElement> {}

export interface DataGridHeaderProps<T extends object>
  extends Omit<
      DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
      'children'
    >,
    Pick<
      DataGridProps<T>,
      'onRemoveColumn' | 'onEditColumn' | 'onInsertColumn'
    > {
  /**
   * Props to be passed to component slots.
   */
  componentsProps?: {
    /**
     * Props to be passed to the `Edit Column` header action item.
     */
    editActionProps?: HeaderActionProps;
    /**
     * Props to be passed to the `Delete Column` header action item.
     */
    deleteActionProps?: HeaderActionProps;
    /**
     * Props to be passed to the `Delete Column` header action item.
     */
    insertActionProps?: HeaderActionProps;
  };
}

// TODO: Get rid of Data Browser related code from here. This component should
// be generic and not depend on Data Browser related data types and logic.
export default function DataGridHeader<T extends object>({
  className,
  onRemoveColumn,
  onEditColumn,
  onInsertColumn,
  componentsProps,
  ...props
}: DataGridHeaderProps<T>) {
  const { flatHeaders } = useDataGridConfig<T>();

  return (
    <div
      className={twMerge(
        'sticky top-0 z-30 inline-flex w-full items-center pr-5',
        className,
      )}
      {...props}
    >
      {flatHeaders.map((column: DataBrowserGridColumn<T>) => {
        const headerProps = column.getHeaderProps({
          style: { display: 'inline-grid' },
        });

        return (
          <Dropdown.Root
            sx={{
              backgroundColor: (theme) =>
                column.isDisabled
                  ? theme.palette.background.default
                  : theme.palette.background.paper,
              color: 'text.primary',
              borderColor: 'grey.300',
            }}
            className={twMerge(
              'group relative inline-flex self-stretch overflow-hidden font-display text-xs font-bold focus:outline-none focus-visible:outline-none',
              'border-b-1 border-r-1',
              column.id === 'selection' && 'sticky left-0 max-w-2',
            )}
            style={{
              ...headerProps.style,
              maxWidth:
                column.id === 'selection' ? 32 : headerProps.style?.maxWidth,
              width:
                column.id === 'selection' ? '100%' : headerProps.style?.width,
              zIndex:
                column.id === 'selection' ? 10 : headerProps.style?.zIndex,
              position: null,
            }}
            key={column.id}
          >
            <DataGridHeaderButton
              column={column}
              headerProps={headerProps}
              onRemoveColumn={onRemoveColumn}
            />
            <Dropdown.Content
              menu
              PaperProps={{ className: 'w-52 mt-1' }}
              className="p-0"
            >
              {onEditColumn && (
                <Dropdown.Item
                  onClick={() => onEditColumn(column)}
                  className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                  disabled={componentsProps?.editActionProps?.disabled}
                >
                  <PencilIcon
                    className="h-4 w-4"
                    sx={{ color: 'text.secondary' }}
                  />

                  <span>Edit Column</span>
                </Dropdown.Item>
              )}

              {onEditColumn && <Divider component="li" sx={{ margin: 0 }} />}

              {!column.disableSortBy && (
                <Dropdown.Item
                  onClick={() => column.toggleSortBy(false)}
                  className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                >
                  <ArrowUpIcon
                    className="h-4 w-4"
                    sx={{ color: 'text.secondary' }}
                  />

                  <span>Sort Ascending</span>
                </Dropdown.Item>
              )}

              {!column.disableSortBy && (
                <Dropdown.Item
                  onClick={() => column.toggleSortBy(true)}
                  className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                >
                  <ArrowDownIcon
                    className="h-4 w-4"
                    sx={{ color: 'text.secondary' }}
                  />

                  <span>Sort Descending</span>
                </Dropdown.Item>
              )}

              {onRemoveColumn && !column.isPrimary && (
                <Divider component="li" className="my-1" />
              )}

              {onRemoveColumn && !column.isPrimary && (
                <Dropdown.Item
                  onClick={() => onRemoveColumn(column)}
                  className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                  disabled={componentsProps?.deleteActionProps?.disabled}
                  sx={{ color: 'error.main' }}
                >
                  <TrashIcon className="h-4 w-4" sx={{ color: 'error.main' }} />

                  <span>Delete Column</span>
                </Dropdown.Item>
              )}
            </Dropdown.Content>
          </Dropdown.Root>
        );
      })}

      {onInsertColumn && (
        <Box className="group relative inline-flex w-25 self-stretch overflow-hidden border-b-1 border-r-1 font-display text-xs font-bold focus:outline-none focus-visible:outline-none">
          <Button
            onClick={onInsertColumn}
            variant="borderless"
            color="secondary"
            className="h-full w-full rounded-none text-xs hover:shadow-none focus:shadow-none focus:outline-none"
            aria-label="Insert New Column"
            disabled={componentsProps?.insertActionProps?.disabled}
          >
            <PlusIcon className="h-4 w-4" sx={{ color: 'text.disabled' }} />
          </Button>
        </Box>
      )}
    </div>
  );
}
