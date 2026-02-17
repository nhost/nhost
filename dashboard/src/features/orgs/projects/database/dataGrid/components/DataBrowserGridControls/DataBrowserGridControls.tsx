import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import type { Row } from 'react-table';
import { twMerge } from 'tailwind-merge';
import { useDialog } from '@/components/common/DialogProvider';
import { Badge } from '@/components/ui/v3/badge';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { DataGridFiltersPopover } from '@/features/orgs/projects/common/components/DataGridFiltersPopover';
import { DataGridTableViewConfigurationPopover } from '@/features/orgs/projects/common/components/DataGridTableViewConfigurationPopover';
import { InvokeEventTriggerButton } from '@/features/orgs/projects/database/dataGrid/components/InvokeEventTriggerButton';
import { useDeleteRecordMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteRecordMutation';
import type { DataBrowserGridColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useGetEventTriggersByTable } from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventTriggersByTable';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import type { DataGridPaginationProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPagination';
import { DataGridPagination } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPagination';
import { cn } from '@/lib/utils';
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
  /**
   * Whether the current table is tracked in Hasura GraphQL.
   */
  isTracked?: boolean;
  /**
   * Callback to track the current table.
   */
  onTrackTable?: () => Promise<void>;
  /**
   * Whether a track operation is in progress.
   */
  isTrackingTable?: boolean;
}

// TODO: Get rid of Data Browser related code from here. This component should
// be generic and not depend on Data Browser related data types and logic.
export default function DataBrowserGridControls({
  paginationProps,
  refetchData,
  onInsertRowClick,
  isTracked,
  onTrackTable,
  isTrackingTable,
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
    <div className="box sticky top-0 z-40 border-b-1 p-2">
      {isTracked === false && (
        <div className="mb-2 flex items-center gap-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-3.5 py-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          <span className="font-medium text-amber-600 text-sm dark:text-amber-400">
            Not tracked in GraphQL
          </span>
          <Button
            onClick={onTrackTable}
            disabled={isTrackingTable}
            loading={isTrackingTable}
            size="sm"
            variant="outline"
            className="ml-auto border-amber-500/30 text-amber-600 text-sm hover:bg-amber-500/10 dark:text-amber-400"
          >
            Track now
          </Button>
        </div>
      )}
      <div
        className={cn(
          'mx-auto grid min-h-10 grid-flow-col items-center gap-3',
          numberOfSelectedRows > 0 ? 'justify-between' : 'justify-end',
        )}
      >
        {numberOfSelectedRows > 0 && (
          <div className="grid grid-flow-col place-content-start items-center gap-2">
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
                selectedValues={selectedRows[0].values}
              />
            )}
          </div>
        )}

        {numberOfSelectedRows === 0 && (
          <div className="col-span-6 grid grid-flow-col items-center gap-2">
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
              <Plus className="h-4 w-4" /> Insert row
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
