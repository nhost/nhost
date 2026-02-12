import { useQueryClient } from '@tanstack/react-query';
import type { CellContext } from '@tanstack/react-table';
import { KeyRound } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { DataBrowserGridControls } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGridControls';
import { DEFAULT_ROWS_LIMIT } from '@/features/orgs/projects/database/dataGrid/constants';
import {
  createTableQueryKey,
  useTableQuery,
} from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type { UpdateRecordVariables } from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateRecordMutation';
import { useUpdateRecordWithToastMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateRecordMutation';
import type {
  DataBrowserColumnMetadata,
  DataBrowserGridColumnDef,
  NormalizedQueryDataRow,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeDefaultValue } from '@/features/orgs/projects/database/dataGrid/utils/normalizeDefaultValue';
import {
  POSTGRESQL_CHARACTER_TYPES,
  POSTGRESQL_DATE_TIME_TYPES,
  POSTGRESQL_JSON_TYPES,
  POSTGRESQL_NUMERIC_TYPES,
} from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import {
  DataGrid,
  type DataGridProps,
  type UnknownDataGridRow,
} from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { DataGridBooleanCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridBooleanCell';
import { DataGridDateCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridDateCell';
import { DataGridNumericCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridNumericCell';
import { DataGridTextCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridTextCell';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import { useDataGridQueryParams } from './DataGridQueryParamsProvider';
import NoMatchesFound from './NoMatchesFound';

const CreateRecordForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/CreateRecordForm/CreateRecordForm'
    ),
  { ssr: false, loading: () => <FormActivityIndicator /> },
);

export interface DataBrowserGridProps extends Partial<DataGridProps> {}

export function extractColumnMetadata(
  column: NormalizedQueryDataRow,
  isEditable: boolean = true,
): DataBrowserColumnMetadata {
  const { normalizedDefaultValue, custom: isDefaultValueCustom } =
    normalizeDefaultValue(column.column_default);

  const metadata: DataBrowserColumnMetadata = {
    id: column.column_name,
    isEditable,
    isPrimary: column.is_primary,
    isNullable: column.is_nullable !== 'NO',
    isIdentity: column.is_identity === 'YES',
    defaultValue: normalizedDefaultValue,
    isDefaultValueCustom,
    isUnique: column.is_unique,
    comment: column.column_comment,
    uniqueConstraints: column.unique_constraints,
    primaryConstraints: column.primary_constraints,
    foreignKeyRelation: column.foreign_key_relation,
    specificType: column.full_data_type,
    dataType: column.data_type,
    type: 'text',
  };

  if (POSTGRESQL_NUMERIC_TYPES.includes(column.data_type)) {
    metadata.type = 'number';
  } else if (column.data_type === 'boolean') {
    metadata.type = 'boolean';
  } else if (column.udt_name === 'uuid') {
    metadata.type = 'uuid';
  } else if (POSTGRESQL_DATE_TIME_TYPES.includes(column.data_type)) {
    metadata.type = 'date';
  }

  return metadata;
}

export function createDataGridColumn(
  column: NormalizedQueryDataRow,
  isEditable: boolean = true,
): DataBrowserGridColumnDef {
  const meta = extractColumnMetadata(column, isEditable);

  const defaultColumnConfiguration = {
    header: () => (
      <div className="grid grid-flow-col items-center justify-start gap-1 font-normal">
        {column.is_primary && <KeyRound width={14} height={14} />}

        <span className="truncate font-bold" title={column.column_name}>
          {column.column_name}
        </span>

        <InlineCode>{column.full_data_type}</InlineCode>
      </div>
    ),
    id: column.column_name,
    accessorKey: column.column_name as string,
    size: 250,
    meta,
    cell: (props: CellContext<UnknownDataGridRow, string>) => (
      <DataGridTextCell {...props} />
    ),
  };

  if (meta.type === 'number') {
    return {
      ...defaultColumnConfiguration,
      size: 250,
      cell: (props: CellContext<UnknownDataGridRow, number | null>) => (
        <DataGridNumericCell {...props} />
      ),
    };
  }

  if (meta.type === 'boolean') {
    return {
      ...defaultColumnConfiguration,
      size: 140,
      cell: (
        props: CellContext<UnknownDataGridRow, boolean | undefined | null>,
      ) => <DataGridBooleanCell {...props} />,
    };
  }

  if (
    POSTGRESQL_CHARACTER_TYPES.includes(column.data_type) ||
    POSTGRESQL_JSON_TYPES.includes(column.data_type)
  ) {
    return {
      ...defaultColumnConfiguration,
      size: 250,
      cell: (props: CellContext<UnknownDataGridRow, string>) => (
        <DataGridTextCell {...props} />
      ),
    };
  }

  if (meta.type === 'uuid') {
    return {
      ...defaultColumnConfiguration,
      size: 318,
      cell: (props: CellContext<UnknownDataGridRow, string>) => (
        <DataGridTextCell {...props} />
      ),
    };
  }

  if (meta.type === 'date') {
    return {
      ...defaultColumnConfiguration,
      size: 200,
      cell: (props: CellContext<UnknownDataGridRow, string>) => (
        <DataGridDateCell {...props} />
      ),
    };
  }

  return defaultColumnConfiguration;
}

export default function DataBrowserGrid(props: DataBrowserGridProps) {
  const dataGridRef = useRef<HTMLDivElement | null>(null);

  const queryClient = useQueryClient();
  const {
    query: { page, dataSourceSlug, schemaSlug, tableSlug, ...query },
    ...router
  } = useRouter();
  const currentTablePath = useTablePath();

  const { openDrawer } = useDialog();

  const {
    isFiltersLoadedFromStorage,
    appliedFilters,
    sortBy,
    setSortBy,
    currentOffset,
    setCurrentOffset,
  } = useDataGridQueryParams();

  const { mutateAsync: updateRow } = useUpdateRecordWithToastMutation();

  const { data, status, error, refetch } = useTableQuery(
    createTableQueryKey(
      currentTablePath,
      currentOffset,
      sortBy,
      appliedFilters,
    ),
    {
      limit: DEFAULT_ROWS_LIMIT,
      offset: currentOffset * DEFAULT_ROWS_LIMIT,
      orderBy:
        sortBy?.map(({ id, desc }) => ({
          columnName: id,
          mode: desc ? 'DESC' : 'ASC',
        })) || [],
      filters: appliedFilters,
      queryOptions: {
        enabled: isFiltersLoadedFromStorage.current,
      },
    },
  );

  const {
    columns,
    rows,
    numberOfRows,
    metadata,
    error: rowQueryError,
  } = data || {
    columns: [] as NormalizedQueryDataRow[],
    rows: [] as NormalizedQueryDataRow[],
    numberOfRows: 0,
    error: null,
  };

  useEffect(() => {
    if (
      currentTablePath &&
      typeof document !== 'undefined' &&
      dataGridRef.current
    ) {
      dataGridRef.current.scrollTo({ top: 0, left: 0 });
    }
  }, [currentTablePath]);

  const numberOfPages = numberOfRows
    ? Math.ceil(numberOfRows / DEFAULT_ROWS_LIMIT)
    : 0;
  const currentPage = Math.min(currentOffset + 1, numberOfPages);

  async function handleOpenPrevPage() {
    const nextOffset = Math.max(currentOffset - 1, 0);

    await router.push({
      pathname: router.pathname,
      query: {
        ...query,
        dataSourceSlug,
        schemaSlug,
        tableSlug,
        page: nextOffset + 1,
      },
    });

    setCurrentOffset(nextOffset);
  }

  async function handleOpenNextPage() {
    const nextOffset = Math.min(currentOffset + 1, numberOfPages - 1);

    await router.push({
      pathname: router.pathname,
      query: {
        ...query,
        dataSourceSlug,
        schemaSlug,
        tableSlug,
        page: nextOffset + 1,
      },
    });

    setCurrentOffset(nextOffset);
  }

  useEffect(() => {
    if (status === 'success' && page && typeof page === 'string') {
      const pageNumber = parseInt(page, 10);
      const newOffset = Math.max(
        Math.min(pageNumber - 1, numberOfPages - 1),
        0,
      );

      if (currentOffset !== newOffset) {
        setCurrentOffset(newOffset);
      }
    }

    if (status === 'success' && !page && currentOffset !== 0) {
      setCurrentOffset(0);
    }
  }, [page, status, numberOfPages, currentOffset, setCurrentOffset]);

  const memoizedColumns = useMemo(
    () =>
      columns.map((column) => {
        const colDef = createDataGridColumn(column, true);

        return {
          ...colDef,
          meta: {
            ...colDef.meta,
            onCellEdit: async (variables: UpdateRecordVariables) => {
              const result = await updateRow(variables);
              await queryClient.invalidateQueries({
                queryKey: [currentTablePath],
              });

              return result;
            },
          },
        };
      }),
    [columns, currentTablePath, queryClient, updateRow],
  );

  const memoizedMetadata = useMemo(
    () => columns.map((column) => extractColumnMetadata(column)),
    [columns],
  );

  const memoizedData = useMemo(() => rows, [rows]);

  async function handleInsertRowClick() {
    openDrawer({
      title: 'Insert a New Row',
      component: (
        <CreateRecordForm
          columns={memoizedMetadata}
          onSubmit={refetch}
          currentOffset={currentOffset}
        />
      ),
    });
  }

  if (metadata?.schemaNotFound) {
    return (
      <DataBrowserEmptyState
        title="Schema not found"
        description={
          <span>
            Schema{' '}
            <InlineCode className="bg-opacity-80 px-1.5 text-sm">
              {metadata.schema || schemaSlug}
            </InlineCode>{' '}
            does not exist.
          </span>
        }
      />
    );
  }

  if (metadata?.tableNotFound) {
    return (
      <DataBrowserEmptyState
        title="Table not found"
        description={
          <span>
            Table{' '}
            <InlineCode className="bg-opacity-80 px-1.5 text-sm">
              {metadata.schema || schemaSlug}.{metadata.table || tableSlug}
            </InlineCode>{' '}
            does not exist.
          </span>
        }
      />
    );
  }

  // We need to display the header when columns are not available in the table,
  // so we are not throwing an error in this case
  if (error && !metadata?.columnsNotFound) {
    throw error || new Error('Unknown error occurred. Please try again later.');
  }

  const noMatchesFound =
    isEmptyValue(memoizedData) && isNotEmptyValue(appliedFilters);

  const emptyStateMessage = noMatchesFound ? (
    <NoMatchesFound />
  ) : (
    'No rows found'
  );

  return (
    <DataGrid
      ref={dataGridRef}
      columns={memoizedColumns}
      data={memoizedData}
      allowSelection
      allowResize
      allowSort
      emptyStateMessage={
        rowQueryError ? (
          <span className="text-destructive">Error: {rowQueryError}</span>
        ) : (
          emptyStateMessage
        )
      }
      loading={status === 'loading'}
      className="pb-17 sm:pb-0"
      onInsertRow={handleInsertRowClick}
      options={{
        manualSorting: true,
        enableMultiSort: false,
      }}
      controls={
        <DataBrowserGridControls
          onInsertRowClick={handleInsertRowClick}
          paginationProps={{
            currentPage: Math.max(currentPage, 1),
            totalPages: Math.max(numberOfPages, 1),
            onOpenPrevPage: handleOpenPrevPage,
            onOpenNextPage: handleOpenNextPage,
          }}
          refetchData={refetch}
        />
      }
      {...props}
      sorting={sortBy}
      onSortingChange={setSortBy}
    />
  );
}
