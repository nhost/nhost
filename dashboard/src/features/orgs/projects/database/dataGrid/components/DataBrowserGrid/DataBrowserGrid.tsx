import { useDialog } from '@/components/common/DialogProvider';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { DataBrowserGridControls } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGridControls';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type { UpdateRecordVariables } from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateRecordMutation';
import { useUpdateRecordWithToastMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateRecordMutation';
import type {
  DataBrowserGridColumn,
  NormalizedQueryDataRow,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeDefaultValue } from '@/features/orgs/projects/database/dataGrid/utils/normalizeDefaultValue';
import {
  POSTGRESQL_CHARACTER_TYPES,
  POSTGRESQL_DATE_TIME_TYPES,
  POSTGRESQL_DECIMAL_TYPES,
  POSTGRESQL_INTEGER_TYPES,
  POSTGRESQL_JSON_TYPES,
} from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import type { DataGridProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { DataGrid } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { DataGridBooleanCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridBooleanCell';
import { DataGridDateCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridDateCell';
import { DataGridDecimalCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridDecimalCell';
import { DataGridIntegerCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridIntegerCell';
import { DataGridTextCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridTextCell';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

const CreateRecordForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/CreateRecordForm/CreateRecordForm'
    ),
  { ssr: false, loading: () => <FormActivityIndicator /> },
);

export interface DataBrowserGridProps extends Partial<DataGridProps<any>> {}

export function createDataGridColumn(
  column: NormalizedQueryDataRow,
  isEditable: boolean = true,
) {
  const { normalizedDefaultValue, custom: isDefaultValueCustom } =
    normalizeDefaultValue(column.column_default);

  const defaultColumnConfiguration = {
    Header: () => (
      <div className="grid grid-flow-col items-center justify-start gap-1 font-normal">
        {column.is_primary && <KeyRound width={14} height={14} />}

        <span className="truncate font-bold" title={column.column_name}>
          {column.column_name}
        </span>

        <InlineCode>{column.full_data_type}</InlineCode>
      </div>
    ),
    id: column.column_name,
    accessor: column.column_name,
    sortType: 'basic',
    width: 250,
    isEditable,
    type: 'text',
    specificType: column.full_data_type,
    maxLength: column.character_maximum_length,
    Cell: DataGridTextCell,
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
  };

  if (POSTGRESQL_INTEGER_TYPES.includes(column.data_type)) {
    return {
      ...defaultColumnConfiguration,
      type: 'number',
      width: 250,
      Cell: DataGridIntegerCell,
    };
  }

  if (POSTGRESQL_DECIMAL_TYPES.includes(column.data_type)) {
    return {
      ...defaultColumnConfiguration,
      type: 'text',
      width: 250,
      Cell: DataGridDecimalCell,
    };
  }

  if (column.data_type === 'boolean') {
    return {
      ...defaultColumnConfiguration,
      type: 'boolean',
      width: 140,
      Cell: DataGridBooleanCell,
    };
  }

  if (
    POSTGRESQL_CHARACTER_TYPES.includes(column.data_type) ||
    POSTGRESQL_JSON_TYPES.includes(column.data_type)
  ) {
    return {
      ...defaultColumnConfiguration,
      type: 'text',
      isCopiable: true,
      width: 250,
      Cell: DataGridTextCell,
    };
  }

  if (column.udt_name === 'uuid') {
    return {
      ...defaultColumnConfiguration,
      type: 'uuid',
      width: 318,
      isCopiable: true,
      Cell: DataGridTextCell,
    };
  }

  if (POSTGRESQL_DATE_TIME_TYPES.includes(column.data_type)) {
    return {
      ...defaultColumnConfiguration,
      type: 'date',
      width: 200,
      Cell: DataGridDateCell,
    };
  }

  return defaultColumnConfiguration;
}

export default function DataBrowserGrid({
  sortBy,
  ...props
}: DataBrowserGridProps) {
  const dataGridRef = useRef<HTMLDivElement | null>(null);

  const queryClient = useQueryClient();
  const {
    query: { page, dataSourceSlug, schemaSlug, tableSlug, ...query },
    ...router
  } = useRouter();
  const currentTablePath = useTablePath();

  const { openDrawer } = useDialog();

  const limit = 25;
  const [currentOffset, setCurrentOffset] = useState<number>(
    parseInt(page as string, 10) - 1 || 0,
  );

  const { mutateAsync: updateRow } = useUpdateRecordWithToastMutation();

  const { data, status, error, refetch } = useTableQuery(
    [currentTablePath, limit, currentOffset, sortBy],
    {
      limit,
      offset: currentOffset * limit,
      orderBy:
        sortBy?.map(({ id, desc }) => ({
          columnName: id,
          mode: desc ? 'DESC' : 'ASC',
        })) || [],
    },
  );

  const { columns, rows, numberOfRows, metadata } = data || {
    columns: [] as NormalizedQueryDataRow[],
    rows: [] as NormalizedQueryDataRow[],
    numberOfRows: 0,
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

  const numberOfPages = numberOfRows ? Math.ceil(numberOfRows / limit) : 0;
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
  }, [page, status, numberOfPages, currentOffset]);

  const memoizedColumns = useMemo(
    () =>
      columns.map((column) => ({
        ...createDataGridColumn(column, true),
        onCellEdit: async (variables: UpdateRecordVariables) => {
          const result = await updateRow(variables);
          await queryClient.invalidateQueries([currentTablePath]);

          return result;
        },
      })),
    [columns, currentTablePath, queryClient, updateRow],
  );

  const memoizedData = useMemo(() => rows, [rows]);

  async function handleInsertRowClick() {
    openDrawer({
      title: 'Insert a New Row',
      component: (
        <CreateRecordForm
          // TODO: Create proper typings for data browser columns
          columns={memoizedColumns as unknown as DataBrowserGridColumn[]}
          onSubmit={refetch}
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
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw error || new Error('Unknown error occurred. Please try again later.');
  }

  return (
    <DataGrid
      ref={dataGridRef}
      columns={memoizedColumns}
      data={memoizedData}
      allowSelection
      allowResize
      allowSort
      emptyStateMessage="No rows found."
      loading={status === 'loading'}
      sortBy={sortBy}
      className="pb-17 sm:pb-0"
      onInsertRow={handleInsertRowClick}
      options={{
        manualSortBy: true,
        disableMultiSort: true,
        autoResetSortBy: false,
        autoResetSelectedRows: false,
        autoResetResize: false,
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
    />
  );
}
