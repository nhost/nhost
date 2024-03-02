import { useDialog } from '@/components/common/DialogProvider';
import { useDataGridConfig } from '@/components/dataGrid/DataGridConfigProvider';
import type { DataGridPaginationProps } from '@/components/dataGrid/DataGridPagination';
import { DataGridPagination } from '@/components/dataGrid/DataGridPagination';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Chip } from '@/components/ui/v2/Chip';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { ColumnIcon } from '@/components/ui/v2/icons/ColumnIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { RowIcon } from '@/components/ui/v2/icons/RowIcon';
import { useDeleteRecordMutation } from '@/features/database/dataGrid/hooks/useDeleteRecordMutation';
import type { DataBrowserGridColumn } from '@/features/database/dataGrid/types/dataBrowser';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { triggerToast } from '@/utils/toast';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Row } from 'react-table';
import { twMerge } from 'tailwind-merge';

export interface DataBrowserGridControlsProps extends BoxProps {
  /**
   * Props passed to the pagination component.
   */
  paginationProps?: DataGridPaginationProps;
  /**
   * Function to be called to refetch data.
   */
  refetchData?: () => Promise<any>;
  /**
   * Function to be called when the button to add a new row is clicked.
   */
  onInsertRowClick?: () => void;
  /**
   * Function to be called when the button to add a new column is clicked.
   */
  onInsertColumnClick?: () => void;
}

// TODO: Get rid of Data Browser related code from here. This component should
// be generic and not depend on Data Browser related data types and logic.
export default function DataBrowserGridControls({
  className,
  paginationProps,
  refetchData,
  onInsertRowClick,
  onInsertColumnClick,
  ...props
}: DataBrowserGridControlsProps) {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const isGitHubConnected = !!currentProject?.githubRepository;
  const queryClient = useQueryClient();
  const { openAlertDialog } = useDialog();

  const { className: paginationClassName, ...restPaginationProps } =
    paginationProps || ({} as DataGridPaginationProps);

  const {
    selectedFlatRows: selectedRows,
    columns,
    toggleAllRowsSelected,
  } = useDataGridConfig();

  const { mutateAsync: removeRows, status } = useDeleteRecordMutation();

  // note: this array ensures that there won't be a glitch with the submit
  // button when files are being deleted
  const [selectedRowsBeforeDelete, setSelectedRowsBeforeDelete] = useState<
    Row[]
  >([]);

  const numberOfSelectedRows =
    selectedRowsBeforeDelete.length || selectedRows?.length;

  async function handleRowDelete() {
    if (!selectedRows?.length) {
      return;
    }

    setSelectedRowsBeforeDelete(selectedRows);

    try {
      const numberOfRemovedRows = await removeRows({
        selectedRows,
        primaryOrUniqueColumns: columns
          .filter(
            (column: DataBrowserGridColumn) =>
              column.isPrimary || column.isUnique,
          )
          .map((column) => column.id),
      });

      triggerToast(
        numberOfRemovedRows === 1
          ? 'The row has been deleted successfully.'
          : `${numberOfRemovedRows} rows have been deleted successfully.`,
      );

      toggleAllRowsSelected(false);

      if (refetchData) {
        await refetchData();
        await queryClient.invalidateQueries({ refetchType: 'inactive' });
      }
    } catch (error) {
      triggerToast(error.message || 'Unknown error occurred');
    }
  }

  return (
    <Box
      className={twMerge('sticky top-0 z-20 border-b-1 p-2', className)}
      {...props}
    >
      <div
        className={twMerge(
          'mx-auto grid min-h-[38px] grid-flow-col items-center gap-3',
          numberOfSelectedRows > 0 ? 'justify-between' : 'justify-end',
        )}
      >
        {numberOfSelectedRows > 0 && (
          <div className="grid grid-flow-col place-content-start items-center gap-2">
            <Chip
              size="small"
              color="info"
              label={`${numberOfSelectedRows} selected`}
            />

            <Button
              variant="borderless"
              color="error"
              size="small"
              loading={status === 'loading'}
              onClick={() =>
                openAlertDialog({
                  title:
                    numberOfSelectedRows === 1
                      ? 'Delete row'
                      : `Delete ${numberOfSelectedRows} rows`,
                  payload: `Are you sure you want to delete the selected ${
                    numberOfSelectedRows === 1 ? 'row' : 'rows'
                  }?`,
                  props: {
                    primaryButtonText:
                      numberOfSelectedRows === 1
                        ? 'Delete'
                        : `Delete ${numberOfSelectedRows} Rows`,
                    primaryButtonColor: 'error',
                    onPrimaryAction: handleRowDelete,
                    TransitionProps: {
                      onExited: () => setSelectedRowsBeforeDelete([]),
                    },
                  },
                })
              }
            >
              Delete
            </Button>
          </div>
        )}

        {numberOfSelectedRows === 0 && (
          <div className="col-span-6 grid grid-flow-col items-center gap-2">
            {columns.length > 0 && (
              <DataGridPagination
                className={twMerge(
                  'col-span-6 h-9 xs+:col-span-2 lg:col-span-2',
                  paginationClassName,
                )}
                {...restPaginationProps}
              />
            )}

            {(onInsertColumnClick ||
              (onInsertRowClick && columns.length > 0)) && (
              <Dropdown.Root>
                <Dropdown.Trigger asChild hideChevron>
                  <Button
                    startIcon={<PlusIcon className="h-4 w-4" />}
                    size="small"
                  >
                    Insert
                  </Button>
                </Dropdown.Trigger>

                <Dropdown.Content
                  menu
                  PaperProps={{
                    className: 'w-full max-w-[140px] mt-1 ml-2',
                  }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                >
                  {onInsertColumnClick && (
                    <Dropdown.Item
                      aria-label="Insert Column"
                      onClick={onInsertColumnClick}
                      className="grid w-full grid-flow-col items-center gap-2 px-3 py-2 text-sm+ font-medium"
                      disabled={isGitHubConnected}
                    >
                      <ColumnIcon
                        className="h-4.5 w-4.5"
                        sx={{ color: 'secondary.800' }}
                      />

                      <span>Column</span>
                    </Dropdown.Item>
                  )}

                  {columns.length > 0 && onInsertRowClick && (
                    <Dropdown.Item
                      aria-label="Insert Row"
                      onClick={onInsertRowClick}
                      className="grid grid-flow-col items-center gap-2 border-t-1 border-solid px-3 py-2 text-sm+ font-medium"
                      sx={{ borderColor: 'grey.300' }}
                    >
                      <RowIcon
                        className="h-4.5 w-4.5"
                        sx={{ color: 'secondary.800' }}
                      />

                      <span>Row</span>
                    </Dropdown.Item>
                  )}
                </Dropdown.Content>
              </Dropdown.Root>
            )}
          </div>
        )}
      </div>
    </Box>
  );
}
