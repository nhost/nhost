import type { OnChangeFn, Row, SortingState } from '@tanstack/react-table';
import type { ForwardedRef, ReactNode } from 'react';
import { forwardRef, useRef } from 'react';
import { mergeRefs } from 'react-merge-refs';
import { Spinner } from '@/components/ui/v3/spinner';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import type { DataBrowserGridColumnDef } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { UseDataGridOptions } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/useDataGrid';
import { DataGridBody } from '@/features/orgs/projects/storage/dataGrid/components/DataGridBody';
import { DataGridConfigProvider } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { DataGridFrame } from '@/features/orgs/projects/storage/dataGrid/components/DataGridFrame';
import type { DataGridHeaderProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGridHeader';
import { DataGridHeader } from '@/features/orgs/projects/storage/dataGrid/components/DataGridHeader';
import { DataTableDesignProvider } from '@/features/orgs/projects/storage/dataGrid/providers/DataTableDesignProvider';
import { cn } from '@/lib/utils';
import AllColumnsHiddenMessage from './AllColumnsHiddenMessage';
import type { UnknownDataGridRow } from './types';
import useDataGrid from './useDataGrid';

export interface DataGridProps<
  TColumnData extends UnknownDataGridRow = UnknownDataGridRow,
> extends Omit<UseDataGridOptions<TColumnData>, 'tableRef'> {
  /**
   * Available columns.
   */
  columns: DataBrowserGridColumnDef<TColumnData>[];
  /**
   * Data to be displayed in the table.
   */
  data: TColumnData[];
  /**
   * Text to be displayed when no data is available in the data grid.
   *
   * @default null
   */
  emptyStateMessage?: ReactNode;
  /**
   * Additional configuration options for the `react-table` hook.
   */
  options?: Partial<UseDataGridOptions<TColumnData>>;
  /**
   * Additional data grid controls. This component will be part of the Data Grid
   * context, so it can use Data Grid configuration.
   */
  controls?: ReactNode;
  /**
   * Function to be called when columns are sorted in the table.
   */
  onSortingChange?: OnChangeFn<SortingState>;
  /**
   * Function to be called when the user wants to insert a new row.
   */
  onInsertRow?: VoidFunction;
  /**
   * Determines whether or not data is loading.
   */
  loading?: boolean;
  /**
   * Class name to be applied to the data grid.
   */
  className?: string;
  /**
   * Sort configuration.
   */
  sorting?: SortingState;
  /**
   * Props to be passed to the `DataGridHeader` component.
   */
  headerProps?: DataGridHeaderProps;
  /**
   * Determines whether the Grid is used for displaying files.
   */
  isRowDisabled?: (row: Row<TColumnData>) => boolean;
}

function DataGrid<TColumnData extends UnknownDataGridRow>(
  {
    columns,
    data,
    allowSelection,
    allowSort,
    allowResize,
    enableRowSelection,
    emptyStateMessage,
    options = {},
    headerProps,
    controls,
    sorting,
    onSortingChange,
    loading,
    className,
    isRowDisabled,
  }: DataGridProps<TColumnData>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  // biome-ignore lint/correctness/useHookAtTopLevel: forwardRef render function with generic type cast
  const tableRef = useRef<HTMLDivElement | null>(null);
  // biome-ignore lint/correctness/useHookAtTopLevel: forwardRef render function with generic type cast
  const dataGridProps = useDataGrid<TColumnData>({
    columns: columns || [],
    data: data || [],
    allowSelection,
    allowSort,
    allowResize,
    sorting,
    enableRowSelection,
    ...options,
    onSortingChange,
  });

  const allColumnsHidden =
    dataGridProps.getAllColumns().filter((column) => column.getIsVisible())
      .length === 1;

  return (
    <DataGridConfigProvider tableRef={tableRef} {...dataGridProps}>
      <DataTableDesignProvider>
        {controls}
        {columns.length === 0 && !loading && (
          <DataBrowserEmptyState
            title="Columns not found"
            description="Please create a column before adding data to the table."
          />
        )}
        {columns.length > 0 && allColumnsHidden && <AllColumnsHiddenMessage />}
        {columns.length > 0 &&
          !allColumnsHidden &&
          dataGridProps.tableInitialized && (
            <div
              ref={mergeRefs([ref, tableRef])}
              className={cn(
                'box overflow-x-auto bg-background',
                { 'h-[calc(100%-1px)]': !loading }, // need to set height like this to remove vertical scrollbar
                className,
              )}
            >
              <DataGridFrame>
                <div className="relative h-full">
                  <DataGridHeader {...headerProps} />
                  <DataGridBody
                    isRowDisabled={isRowDisabled}
                    emptyStateMessage={emptyStateMessage}
                    loading={loading}
                  />
                </div>
              </DataGridFrame>
            </div>
          )}

        {(loading || !dataGridProps.tableInitialized) && (
          <Spinner className="my-4" />
        )}
      </DataTableDesignProvider>
    </DataGridConfigProvider>
  );
}

export default forwardRef(DataGrid) as <TColumnData extends UnknownDataGridRow>(
  props: DataGridProps<TColumnData> & { ref?: ForwardedRef<HTMLDivElement> },
) => ReturnType<typeof DataGrid>;
