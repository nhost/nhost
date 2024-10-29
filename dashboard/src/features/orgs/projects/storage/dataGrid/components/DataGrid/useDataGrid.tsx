import { Checkbox } from '@/components/ui/v2/Checkbox';
import type { MutableRefObject } from 'react';
import { useMemo } from 'react';
import type { PluginHook, TableInstance, TableOptions } from 'react-table';
import {
  useBlockLayout,
  useResizeColumns,
  useRowSelect,
  useSortBy,
  useTable,
} from 'react-table';

export interface UseDataGridBaseOptions {
  /**
   * Determines whether data grid columns are selectable.
   *
   * @default false
   */
  allowSelection?: boolean;
  /**
   * Determines whether data grid columns are sortable.
   *
   * @default false
   */
  allowSort?: boolean;
  /**
   * Determine whether data grid columns are resizable.
   *
   * @default false
   */
  allowResize?: boolean;
  /**
   * Reference to the data grid root element.
   */
  tableRef?: MutableRefObject<HTMLDivElement>;
}

export type UseDataGridOptions<T extends object = {}> = TableOptions<T> &
  UseDataGridBaseOptions;
export type UseDataGridReturn<T extends object = {}> = TableInstance<T> &
  UseDataGridBaseOptions;

export default function useDataGrid<T extends object>(
  { allowSelection, allowSort, allowResize, ...options }: UseDataGridOptions<T>,
  ...plugins: PluginHook<T>[]
): UseDataGridReturn<T> {
  const defaultColumn = useMemo(
    () => ({
      width: 32,
      minWidth: 32,
      Cell: ({ value }: { value: any }) => (
        <span className="truncate">
          {typeof value === 'object' ? JSON.stringify(value) : value}
        </span>
      ),
    }),
    [],
  );

  const pluginHooks = [
    useBlockLayout,
    useResizeColumns,
    useSortBy,
    useRowSelect,
  ];

  const tableData = useTable<T>(
    {
      defaultColumn,
      ...options,
    },
    ...pluginHooks,
    ...plugins,
    (hooks) =>
      allowSelection
        ? hooks.visibleColumns.push((columns) => [
            {
              id: 'selection',
              Header: ({ rows, getToggleAllRowsSelectedProps }: any) => (
                <Checkbox
                  disabled={rows.length === 0}
                  {...getToggleAllRowsSelectedProps({ style: null })}
                  style={{
                    ...getToggleAllRowsSelectedProps().style,
                    cursor: rows.length === 0 ? 'default' : 'pointer',
                  }}
                />
              ),
              Cell: ({ row }: any) => {
                const originalValue = row.original as any;

                return (
                  <Checkbox
                    {...row.getToggleRowSelectedProps()}
                    // disable selection if row is just a upload preview
                    checked={originalValue.uploading ? false : row.isSelected}
                    disabled={originalValue.uploading}
                  />
                );
              },
              disableSortBy: true,
              disableResizing: true,
            },
            ...columns,
          ])
        : hooks.visibleColumns,
  );

  return { ...tableData, allowSort, allowResize, allowSelection };
}
