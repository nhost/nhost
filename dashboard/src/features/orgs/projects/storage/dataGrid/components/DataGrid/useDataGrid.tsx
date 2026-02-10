import type { RefObject } from 'react';
import { useMemo } from 'react';
import type { PluginHook, TableInstance, TableOptions } from 'react-table';
import {
  useBlockLayout,
  useColumnOrder,
  useResizeColumns,
  useRowSelect,
  useSortBy,
  useTable,
} from 'react-table';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import {
  getColumnOrder,
  getHiddenColumns,
} from '@/features/orgs/projects/storage/dataGrid/utils/PersistentDataTableConfigurationStorage';

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
  tableRef?: RefObject<HTMLDivElement | null>;
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
      // biome-ignore lint/suspicious/noExplicitAny: TODO
      Cell: ({ value }: { value: any }) => (
        <span className="truncate">
          {typeof value === 'object' ? JSON.stringify(value) : value}
        </span>
      ),
    }),
    [],
  );

  const tablePath = useTablePath();

  const pluginHooks = [
    useBlockLayout,
    useResizeColumns,
    useSortBy,
    useRowSelect,
    useColumnOrder,
  ];

  const tableData = useTable<T>(
    {
      defaultColumn,
      ...options,
      initialState: {
        hiddenColumns:
          getHiddenColumns(tablePath),
        columnOrder: getColumnOrder(tablePath),
      },
    },
    ...pluginHooks,
    ...plugins,
    (hooks) =>
      allowSelection
        ? hooks.visibleColumns.push((columns) => [
            {
              id: 'selection-column',
              // biome-ignore lint/suspicious/noExplicitAny: TODO
              Header: ({ rows, getToggleAllRowsSelectedProps }: any) => {
                const { indeterminate, style, onChange, ...props } =
                  getToggleAllRowsSelectedProps();

                function handleCheckedChange(newCheckedState: boolean) {
                  onChange({ target: { checked: newCheckedState } });
                }
                return (
                  <Checkbox
                    className="data-[state=checked]:!border-transparent border-[#21324b] dark:border-[#dfecf5]"
                    disabled={rows.length === 0}
                    {...props}
                    style={{
                      ...style,
                      cursor: rows.length === 0 ? 'default' : 'pointer',
                    }}
                    onCheckedChange={handleCheckedChange}
                  />
                );
              },
              // biome-ignore lint/suspicious/noExplicitAny: TODO
              Cell: ({ row }: any) => {
                // biome-ignore lint/suspicious/noExplicitAny: TODO
                const originalValue = row.original as any;

                const { indeterminate, onChange, ...props } =
                  row.getToggleRowSelectedProps();

                function handleCheckedChange(newCheckedState: boolean) {
                  onChange({ target: { checked: newCheckedState } });
                }
                return (
                  <Checkbox
                    className="data-[state=checked]:!border-transparent border-[#21324b] dark:border-[#dfecf5]"
                    {...props}
                    // disable selection if row is just a upload preview
                    checked={originalValue.uploading ? false : row.isSelected}
                    disabled={originalValue.uploading}
                    onCheckedChange={handleCheckedChange}
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
