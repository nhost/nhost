import { useQueryClient } from '@tanstack/react-query';
import type { Row } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { useDialog } from '@/components/common/DialogProvider';
import { Badge } from '@/components/ui/v3/badge';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { DataGridFiltersPopover } from '@/features/orgs/projects/common/components/DataGridFiltersPopover';
import { DataGridTableViewConfigurationPopover } from '@/features/orgs/projects/common/components/DataGridTableViewConfigurationPopover';
import { InvokeEventTriggerButton } from '@/features/orgs/projects/database/dataGrid/components/InvokeEventTriggerButton';
import { TrackTableButton } from '@/features/orgs/projects/database/dataGrid/components/TrackTableButton';
import { useDeleteRecordMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteRecordMutation';
import { useGetEventTriggersByTable } from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventTriggersByTable';
import type { UnknownDataGridRow } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import type { DataGridPaginationProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPagination';
import { DataGridPagination } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPagination';
import { triggerToast } from '@/utils/toast';

export interface DataBrowserGridControlsProps {
  /**
   * Props passed to the pagination component.
   */
  paginationProps?: DataGridPaginationProps;
  /**
   * Function to be called to refetch data.
   */
  refetchData?: () => Promise<unknown>;
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

  const { getSelectedRowModel, getAllColumns, toggleAllRowsSelected } =
    useDataGridConfig<Record<string, unknown>>();

  const selectedRows = getSelectedRowModel().flatRows;
  const columns = getAllColumns();

  const { mutateAsync: removeRows, status } = useDeleteRecordMutation();

  // note: this array ensures that there won't be a glitch with the submit
  // button when files are being deleted
  const [selectedRowsBeforeDelete, setSelectedRowsBeforeDelete] = useState<
    Row<UnknownDataGridRow>[]
  >([]);

  const router = useRouter();
  const { dataSourceSlug, schemaSlug, tableSlug } = router.query;

  const { data: eventTriggersByTable } = useGetEventTriggersByTable({
    table: { name: tableSlug as string, schema: schemaSlug as string },
    dataSource: dataSourceSlug as string,
    queryOptions: {
      enabled:
        typeof tableSlug === 'string' &&
        typeof schemaSlug === 'string' &&
        typeof dataSourceSlug === 'string',
    },
  });

  const numberOfSelectedRows =
    selectedRowsBeforeDelete.length || selectedRows?.length;
  const eventTriggersCount = eventTriggersByTable?.length ?? 0;

  const showInvokeEventTriggerButton =
    selectedRows?.length === 1 && eventTriggersCount > 0;

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
            (column) =>
              column.columnDef.meta?.isPrimary ||
              column.columnDef.meta?.isUnique,
          )
          .map((column) => column.id!),
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
    <div className="box sticky top-0 z-40 border-b-1 p-2">
      <div className="mx-auto flex min-h-10 items-center gap-3">
        {numberOfSelectedRows > 0 && (
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="!bg-[#ebf3ff] dark:!bg-[#1b2534] text-primary"
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
            {showInvokeEventTriggerButton && (
              <InvokeEventTriggerButton
                selectedValues={selectedRows[0].original}
              />
            )}
          </div>
        )}

        {numberOfSelectedRows === 0 && (
          <>
            <TrackTableButton />
            <div className="ml-auto flex items-center gap-2">
              {columns.length > 0 && (
                <DataGridPagination
                  className={twMerge(
                    'col-span-6 xs+:col-span-2 h-9 lg:col-span-2',
                    paginationClassName,
                  )}
                  {...restPaginationProps}
                />
              )}
              <DataGridFiltersPopover />
              <DataGridTableViewConfigurationPopover />
              <Button onClick={onInsertRowClick} size="sm">
                <Plus className="h-4 w-4" />
                <span className="sm:hidden">Insert</span>
                <span className="hidden sm:inline">Insert row</span>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
