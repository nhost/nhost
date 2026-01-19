import type { ForwardedRef, ReactNode } from 'react';
import { forwardRef, useEffect, useRef } from 'react';
import { mergeRefs } from 'react-merge-refs';
import type { Column, SortingRule, TableOptions } from 'react-table';
import { Spinner } from '@/components/ui/v3/spinner';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import type { UseDataGridOptions } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/useDataGrid';
import { DataGridBody } from '@/features/orgs/projects/storage/dataGrid/components/DataGridBody';
import { DataGridConfigProvider } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { DataGridFrame } from '@/features/orgs/projects/storage/dataGrid/components/DataGridFrame';
import type { DataGridHeaderProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGridHeader';
import { DataGridHeader } from '@/features/orgs/projects/storage/dataGrid/components/DataGridHeader';
import { DataTableDesignProvider } from '@/features/orgs/projects/storage/dataGrid/providers/DataTableDesignProvider';
import { cn } from '@/lib/utils';
import AllColumnsHiddenMessage from './AllColumnsHiddenMessage';
import useDataGrid from './useDataGrid';

export interface DataGridProps<TColumnData extends object>
  extends Omit<UseDataGridOptions<TColumnData>, 'tableRef'> {
  /**
   * Available columns.
   */
  columns: Column<TColumnData>[];
  /**
   * Data to be displayed in the table.
   */
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  data: any[];
  /**
   * Text to be displayed when no data is available in the data grid.
   *
   * @default null
   */
  emptyStateMessage?: ReactNode;
  /**
   * Additional configuration options for the `react-table` hook.
   */
  options?: Omit<TableOptions<TColumnData>, 'columns' | 'data'>;
  /**
   * Additional data grid controls. This component will be part of the Data Grid
   * context, so it can use Data Grid configuration.
   */
  controls?: ReactNode;
  /**
   * Function to be called when columns are sorted in the table.
   */
  onSort?: (args: SortingRule<TColumnData>[]) => void;
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
  sortBy?: SortingRule<TColumnData>[];
  /**
   * Props to be passed to the `DataGridHeader` component.
   */
  headerProps?: DataGridHeaderProps;
  /**
   * Determines whether the Grid is used for displaying files.
   */
  isFileDataGrid?: boolean;
}

function DataGrid<TColumnData extends object>(
  {
    columns,
    data,
    allowSelection,
    allowSort,
    allowResize,
    emptyStateMessage,
    options = {},
    headerProps,
    controls,
    sortBy,
    onSort,
    loading,
    className,
    isFileDataGrid,
  }: DataGridProps<TColumnData>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const tableRef = useRef<HTMLDivElement | null>(null);
  const { toggleAllRowsSelected, setSortBy, ...dataGridProps } =
    useDataGrid<TColumnData>({
      columns: columns || [],
      data: data || [],
      allowSelection,
      allowSort,
      allowResize,
      ...options,
    });

  useEffect(() => {
    if (!sortBy && setSortBy) {
      setSortBy([]);
    }
  }, [setSortBy, sortBy]);

  useEffect(() => {
    if (onSort && allowSort) {
      onSort(dataGridProps.state.sortBy);

      if (toggleAllRowsSelected) {
        toggleAllRowsSelected(false);
      }
    }
  }, [allowSort, dataGridProps.state.sortBy, onSort, toggleAllRowsSelected]);

  const allColumnsHidden =
    dataGridProps.allColumns.filter(({ isVisible }) => isVisible).length === 1;

  return (
    <DataGridConfigProvider
      toggleAllRowsSelected={toggleAllRowsSelected}
      setSortBy={setSortBy}
      tableRef={tableRef}
      {...dataGridProps}
    >
      <DataTableDesignProvider>
        {controls}
        {columns.length === 0 && !loading && (
          <DataBrowserEmptyState
            title="Columns not found"
            description="Please create a column before adding data to the table."
          />
        )}
        {columns.length > 0 && allColumnsHidden && <AllColumnsHiddenMessage />}
        {columns.length > 0 && !allColumnsHidden && (
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
                  isFileDataGrid={isFileDataGrid}
                  emptyStateMessage={emptyStateMessage}
                  loading={loading}
                />
              </div>
            </DataGridFrame>
          </div>
        )}

        {loading && <Spinner className="my-4" />}
      </DataTableDesignProvider>
    </DataGridConfigProvider>
  );
}

export default forwardRef(DataGrid) as <TColumnData extends object>(
  props: DataGridProps<TColumnData> & { ref?: ForwardedRef<HTMLDivElement> },
) => ReturnType<typeof DataGrid>;
