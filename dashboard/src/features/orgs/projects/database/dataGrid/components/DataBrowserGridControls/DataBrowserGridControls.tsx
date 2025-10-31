import { useDialog } from '@/components/common/DialogProvider';
import { Badge } from '@/components/ui/v3/badge';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { useDeleteRecordMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteRecordMutation';
import type { DataBrowserGridColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import type { DataGridPaginationProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPagination';
import { DataGridPagination } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPagination';
import { cn } from '@/lib/utils';

import { triggerToast } from '@/utils/toast';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { Row } from 'react-table';
import { twMerge } from 'tailwind-merge';
import DataTableDesignPopup from './DataTableDesignPopup';

export interface DataBrowserGridControlsProps {
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
}

// TODO: Get rid of Data Browser related code from here. This component should
// be generic and not depend on Data Browser related data types and logic.
export default function DataBrowserGridControls({
  paginationProps,
  refetchData,
  onInsertRowClick,
}: DataBrowserGridControlsProps) {
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
    <div className="box sticky top-0 z-20 border-b-1 p-2">
      <div
        className={cn(
          'mx-auto grid min-h-[38px] grid-flow-col items-center gap-3',
          numberOfSelectedRows > 0 ? 'justify-between' : 'justify-end',
        )}
      >
        {numberOfSelectedRows > 0 && (
          <div className="grid grid-flow-col place-content-start items-center gap-2">
            <Badge
              variant="secondary"
              className="!bg-[#ebf3ff] text-primary dark:!bg-[#1b2534]"
            >
              {`${numberOfSelectedRows} selected`}
            </Badge>

            <Button
              variant="outline"
              size="sm"
              className="border-none text-destructive hover:bg-[#f131541a] hover:text-destructive"
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
            <DataTableDesignPopup />
            <Button onClick={onInsertRowClick} size="sm">
              <Plus className="h-4 w-4" /> Insert row
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
