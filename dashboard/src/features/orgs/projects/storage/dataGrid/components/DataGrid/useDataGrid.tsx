import {
  type CellContext,
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type Row,
  type SortingState,
  type Table,
  type TableOptions,
  useReactTable,
} from '@tanstack/react-table';
import type { ReactNode, RefObject } from 'react';
import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import {
  convertToV8IfNeeded,
  getColumnOrder,
  getColumnVisibility,
} from '@/features/orgs/projects/storage/dataGrid/utils/PersistentDataTableConfigurationStorage';
import { SELECTION_COLUMN_ID } from './constants';
import type { UnknownDataGridRow } from './types';

if (typeof window !== 'undefined') {
  convertToV8IfNeeded();
}

export interface UseDataGridBaseOptions<
  T extends UnknownDataGridRow = UnknownDataGridRow,
> {
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
  /**
   * Determines whether a row is selectable.
   *
   * @default true
   */
  enableRowSelection?: boolean | ((row: Row<T>) => boolean);
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
}

export type UseDataGridOptions<
  T extends UnknownDataGridRow = UnknownDataGridRow,
> = Omit<TableOptions<T>, 'getCoreRowModel' | 'onSortingChange' | 'state'> &
  UseDataGridBaseOptions<T>;

export type UseDataGridReturn<
  T extends UnknownDataGridRow = UnknownDataGridRow,
> = Table<T> &
  Omit<
    UseDataGridBaseOptions<T>,
    'enableRowSelection' | 'onSortingChange' | 'sorting'
  >;

export default function useDataGrid<T extends UnknownDataGridRow>({
  data,
  columns,
  allowSelection,
  allowSort,
  allowResize,
  enableRowSelection = true,
  sorting,
  onSortingChange,
  ...options
}: UseDataGridOptions<T>): UseDataGridReturn<T> {
  const tablePath = useTablePath();

  const defaultColumn: Partial<ColumnDef<T>> = useMemo(
    () => ({
      minSize: 32,
      size: 32,
      cell: ({ getValue }: CellContext<T, unknown>) => {
        const value = getValue();
        return (
          <span className="truncate">
            {typeof value === 'object'
              ? JSON.stringify(value)
              : (value as ReactNode)}
          </span>
        );
      },
    }),
    [],
  );

  const tableColumns = useMemo(() => {
    if (!allowSelection) {
      return columns;
    }

    const selectionColumn: ColumnDef<T> = {
      id: SELECTION_COLUMN_ID,
      header: ({ table }) => (
        <Checkbox
          className="data-[state=checked]:!border-transparent border-[#21324b] dark:border-[#dfecf5]"
          checked={table.getIsAllRowsSelected()}
          disabled={table.getRowModel().rows.length === 0}
          onCheckedChange={(checked) =>
            table.getToggleAllRowsSelectedHandler()({ target: { checked } })
          }
          style={{
            cursor:
              table.getRowModel().rows.length === 0 ? 'default' : 'pointer',
          }}
        />
      ),
      cell: ({ row }) => {
        return (
          <Checkbox
            className="data-[state=checked]:!border-transparent border-[#21324b] dark:border-[#dfecf5]"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onCheckedChange={row.getToggleSelectedHandler()}
          />
        );
      },
      enableSorting: false,
      enableResizing: false,
    };

    return [selectionColumn, ...columns];
  }, [columns, allowSelection]);

  const reactTable = useReactTable({
    data,
    columns: tableColumns,
    defaultColumn,
    initialState: {
      columnVisibility: getColumnVisibility(tablePath),
      columnOrder: getColumnOrder(tablePath),
    },
    state: {
      ...(sorting !== undefined ? { sorting } : {}),
    },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: allowSort ? getSortedRowModel() : undefined,
    enableRowSelection,
    enableColumnResizing: allowResize,
    columnResizeMode: 'onChange',
    ...options,
  });

  return {
    ...reactTable,
    allowSort,
    allowResize,
    allowSelection,
  };
}
