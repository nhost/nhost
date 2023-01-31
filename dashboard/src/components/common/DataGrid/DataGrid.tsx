import DataGridBody from '@/components/common/DataGridBody';
import DataGridFrame from '@/components/common/DataGridFrame';
import type { DataGridHeaderProps } from '@/components/common/DataGridHeader';
import DataGridHeader from '@/components/common/DataGridHeader';
import DataBrowserEmptyState from '@/components/dataBrowser/DataBrowserEmptyState';
import { DataGridProvider } from '@/context/DataGridContext';
import type { UseDataGridOptions } from '@/hooks/useDataGrid';
import useDataGrid from '@/hooks/useDataGrid';
import type { DataBrowserGridColumn } from '@/types/dataBrowser';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import type { ForwardedRef } from 'react';
import { forwardRef, useEffect, useRef } from 'react';
import mergeRefs from 'react-merge-refs';
import type { Column, Row, SortingRule, TableOptions } from 'react-table';
import { twMerge } from 'tailwind-merge';

export interface DataGridProps<TColumnData extends object>
  extends Omit<UseDataGridOptions<TColumnData>, 'tableRef'> {
  /**
   * Available columns.
   */
  columns: Column<TColumnData>[];
  /**
   * Data to be displayed in the table.
   */
  data: any[];
  /**
   * Text to be displayed when no data is available in the data grid.
   *
   * @default null
   */
  emptyStateMessage?: string;
  /**
   * Additional configuration options for the `react-table` hook.
   */
  options?: Omit<TableOptions<TColumnData>, 'columns' | 'data'>;
  /**
   * Additional data grid controls. This component will be part of the Data Grid
   * context, so it can use Data Grid configuration.
   */
  controls?:
    | React.ReactNode
    | ((selectedFlatRows: Row<TColumnData>[]) => React.ReactNode);
  /**
   * Function to be called when columns are sorted in the table.
   */
  onSort?: (args: SortingRule<TColumnData>[]) => void;
  /**
   * Function to be called when the user wants to insert a new row.
   */
  onInsertRow?: VoidFunction;
  /**
   * Function to be called when the user wants to insert a new column.
   */
  onInsertColumn?: VoidFunction;
  /**
   * Function to be called when the user wants to remove a column.
   */
  onRemoveColumn?: (column: DataBrowserGridColumn<TColumnData>) => void;
  /**
   * Function to be called when the user wants to edit a column.
   */
  onEditColumn?: (column: DataBrowserGridColumn<TColumnData>) => void;
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
  headerProps?: DataGridHeaderProps<TColumnData>;
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
    onInsertRow,
    onInsertColumn,
    onEditColumn,
    onRemoveColumn,
    loading,
    className,
  }: DataGridProps<TColumnData>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const tableRef = useRef<HTMLDivElement>();
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

  return (
    <DataGridProvider
      toggleAllRowsSelected={toggleAllRowsSelected}
      setSortBy={setSortBy}
      tableRef={tableRef}
      {...dataGridProps}
    >
      <>
        {controls}

        {columns.length === 0 && !loading && (
          <DataBrowserEmptyState
            title="Columns not found"
            description="Please create a column before adding data to the table."
          />
        )}

        {columns.length > 0 && (
          <Box
            ref={mergeRefs([ref, tableRef])}
            sx={{ backgroundColor: 'background.default' }}
            className={twMerge(
              'overflow-x-auto',
              !loading && 'h-full',
              className,
            )}
          >
            <DataGridFrame>
              <DataGridHeader
                onInsertColumn={onInsertColumn}
                onEditColumn={onEditColumn}
                onRemoveColumn={onRemoveColumn}
                {...headerProps}
              />

              <DataGridBody
                emptyStateMessage={emptyStateMessage}
                loading={loading}
                onInsertRow={onInsertRow}
                allowInsertColumn={Boolean(onRemoveColumn)}
              />
            </DataGridFrame>
          </Box>
        )}

        {loading && <ActivityIndicator delay={1000} className="my-4" />}
      </>
    </DataGridProvider>
  );
}

export default forwardRef(DataGrid) as <TColumnData extends object>(
  props: DataGridProps<TColumnData> & { ref?: ForwardedRef<HTMLDivElement> },
) => ReturnType<typeof DataGrid>;
