import { useQueryClient } from '@tanstack/react-query';
import type { CellContext, Row } from '@tanstack/react-table';
import { Copy, Edit, KeyRound, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { usePageBoundsRedirect } from '@/features/orgs/projects/common/hooks/usePageBoundsRedirect';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { DataBrowserGridControls } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGridControls';
import { DEFAULT_ROWS_LIMIT } from '@/features/orgs/projects/database/dataGrid/constants';
import { useDeleteRecordMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteRecordMutation';
import { useIsReadOnlyDatabaseObject } from '@/features/orgs/projects/database/dataGrid/hooks/useIsReadOnlyDatabaseObject';
import { useRefreshMaterializedView } from '@/features/orgs/projects/database/dataGrid/hooks/useRefreshMaterializedView';
import {
  createTableQueryKey,
  useTableQuery,
} from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import { useTableType } from '@/features/orgs/projects/database/dataGrid/hooks/useTableType';
import type { UpdateRecordVariables } from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateRecordMutation';
import { useUpdateRecordWithToastMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateRecordMutation';
import type {
  DataBrowserColumnMetadata,
  DataBrowserGridColumnDef,
  NormalizedQueryDataRow,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getBaseType } from '@/features/orgs/projects/database/dataGrid/utils/getBaseType';
import { getDisplayType } from '@/features/orgs/projects/database/dataGrid/utils/getDisplayType';
import { isArray } from '@/features/orgs/projects/database/dataGrid/utils/isArray';
import { isGeneratedColumn } from '@/features/orgs/projects/database/dataGrid/utils/isGeneratedColumn';
import { normalizeDefaultValue } from '@/features/orgs/projects/database/dataGrid/utils/normalizeDefaultValue';
import {
  POSTGRESQL_CHARACTER_TYPES,
  POSTGRESQL_JSON_TYPES,
  POSTGRESQL_NUMERIC_TYPES,
  POSTGRESQL_UNSORTABLE_TYPES,
} from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import { isTemporalType } from '@/features/orgs/projects/database/dataGrid/utils/temporalTypeHelpers';
import {
  DataGrid,
  type DataGridProps,
  type UnknownDataGridRow,
} from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { DataGridBooleanCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridBooleanCell';
import { DataGridNumericCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridNumericCell';
import { DataGridTextCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridTextCell';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import { triggerToast } from '@/utils/toast';
import { useDataGridQueryParams } from './DataGridQueryParamsProvider';
import GeneratedColumnIndicator from './GeneratedColumnIndicator';
import NoMatchesFound from './NoMatchesFound';

const CreateRecordForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/CreateRecordForm/CreateRecordForm'
    ),
  { ssr: false, loading: () => <FormActivityIndicator /> },
);

const EditRecordForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditRecordForm/EditRecordForm'
    ),
  { ssr: false, loading: () => <FormActivityIndicator /> },
);

interface DataBrowserGridProps extends Partial<DataGridProps> {}

export function extractColumnMetadata(
  column: NormalizedQueryDataRow,
  isEditable: boolean = true,
): DataBrowserColumnMetadata {
  const normalizedDefault = normalizeDefaultValue(column.column_default);

  const isGenerated = isGeneratedColumn(column);

  const metadata: DataBrowserColumnMetadata = {
    id: column.column_name,
    isEditable: isGenerated ? false : isEditable,
    isPrimary: column.is_primary,
    isNullable: column.is_nullable !== 'NO',
    isIdentity: column.is_identity === 'YES',
    isGenerated,
    generationExpression: column.generation_expression ?? null,
    defaultValue: normalizedDefault ?? null,
    isUnique: column.is_unique,
    comment: column.column_comment,
    uniqueConstraints: column.unique_constraints,
    primaryConstraints: column.primary_constraints,
    foreignKeyRelation: column.foreign_key_relation,
    specificType: column.full_data_type,
    baseType: getBaseType(column.full_data_type),
    isArray: isArray(column.full_data_type),
    displayType: getDisplayType(column.full_data_type),
  };

  return metadata;
}

export function createDataGridColumn(
  column: NormalizedQueryDataRow,
  isEditable: boolean = true,
  // biome-ignore lint/suspicious/noExplicitAny: Cell types are dynamically typed depending on postgres columns
): DataBrowserGridColumnDef<UnknownDataGridRow, any> {
  const meta = extractColumnMetadata(column, isEditable);

  const isSortable =
    !POSTGRESQL_UNSORTABLE_TYPES.includes(column.udt_name) &&
    !POSTGRESQL_UNSORTABLE_TYPES.includes(column.data_type);

  const defaultColumnConfiguration = {
    header: () => (
      <div className="grid grid-flow-col items-center justify-start gap-1 font-normal">
        {column.is_primary && <KeyRound width={14} height={14} />}
        {meta.isGenerated && meta.generationExpression && (
          <GeneratedColumnIndicator
            generationExpression={meta.generationExpression}
          />
        )}

        <span className="truncate font-bold" title={column.column_name}>
          {column.column_name}
        </span>

        <InlineCode>{meta.displayType}</InlineCode>
      </div>
    ),
    id: column.column_name,
    accessorKey: column.column_name as string,
    size: 250,
    meta,
    enableSorting: isSortable,
    cell: (props: CellContext<UnknownDataGridRow, string>) => (
      <DataGridTextCell {...props} />
    ),
  };

  if (meta.isArray) {
    return {
      ...defaultColumnConfiguration,
      size: 250,
      cell: (props: CellContext<UnknownDataGridRow, string>) => (
        <DataGridTextCell {...props} />
      ),
    };
  }

  if (POSTGRESQL_NUMERIC_TYPES.includes(meta.baseType)) {
    return {
      ...defaultColumnConfiguration,
      size: 250,
      cell: (props: CellContext<UnknownDataGridRow, number | null>) => (
        <DataGridNumericCell {...props} />
      ),
    };
  }

  if (meta.baseType === 'boolean') {
    return {
      ...defaultColumnConfiguration,
      size: 140,
      cell: (
        props: CellContext<UnknownDataGridRow, boolean | undefined | null>,
      ) => <DataGridBooleanCell {...props} />,
    };
  }

  if (
    POSTGRESQL_CHARACTER_TYPES.includes(meta.baseType) ||
    POSTGRESQL_JSON_TYPES.includes(meta.baseType)
  ) {
    return {
      ...defaultColumnConfiguration,
      size: 250,
      cell: (props: CellContext<UnknownDataGridRow, string>) => (
        <DataGridTextCell {...props} />
      ),
    };
  }

  if (meta.baseType === 'uuid') {
    return {
      ...defaultColumnConfiguration,
      size: 318,
      cell: (props: CellContext<UnknownDataGridRow, string>) => (
        <DataGridTextCell {...props} />
      ),
    };
  }

  if (isTemporalType(meta.baseType)) {
    return {
      ...defaultColumnConfiguration,
      size: 200,
      cell: (props: CellContext<UnknownDataGridRow, string>) => (
        <DataGridTextCell {...props} />
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

  const { openDrawer, openAlertDialog } = useDialog();

  const { appliedFilters, sortBy, setSortBy, currentOffset } =
    useDataGridQueryParams();

  const { mutateAsync: updateRow } = useUpdateRecordWithToastMutation();
  const { mutateAsync: removeRows } = useDeleteRecordMutation();

  const isReadOnlyObject = useIsReadOnlyDatabaseObject({
    dataSource: dataSourceSlug as string,
    schema: schemaSlug as string,
    name: tableSlug as string,
    queryOptions: {
      enabled:
        typeof schemaSlug === 'string' &&
        typeof tableSlug === 'string' &&
        typeof dataSourceSlug === 'string',
    },
  });

  const { tableType } = useTableType({
    dataSource: dataSourceSlug as string,
    schema: schemaSlug as string,
    name: tableSlug as string,
    queryOptions: {
      enabled:
        typeof schemaSlug === 'string' &&
        typeof tableSlug === 'string' &&
        typeof dataSourceSlug === 'string',
    },
  });
  const isMaterializedView = tableType === 'MATERIALIZED VIEW';

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
    },
  );

  const {
    handleRefresh: handleRefreshMaterializedViewClick,
    isRefreshing: isRefreshingMaterializedView,
  } = useRefreshMaterializedView({ refetch });

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

  usePageBoundsRedirect(numberOfPages, status === 'loading');

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
  }

  const memoizedMetadata = useMemo(
    () => columns.map((column) => extractColumnMetadata(column)),
    [columns],
  );

  const handleCloneClick = useCallback(
    (initialValues: Record<string, unknown>) => {
      openDrawer({
        title: 'Clone Row',
        component: (
          <CreateRecordForm
            columns={memoizedMetadata}
            initialValues={initialValues}
            onSubmit={refetch}
            currentOffset={currentOffset}
          />
        ),
      });
    },
    [openDrawer, memoizedMetadata, refetch, currentOffset],
  );

  const handleEditClick = useCallback(
    (row: Row<UnknownDataGridRow>) => {
      openDrawer({
        title: 'Edit Row',
        component: (
          <EditRecordForm
            row={row}
            columns={memoizedMetadata}
            onSubmit={refetch}
            currentOffset={currentOffset}
          />
        ),
      });
    },
    [openDrawer, memoizedMetadata, refetch, currentOffset],
  );

  const handleDeleteClick = useCallback(
    async (row: Row<UnknownDataGridRow>) => {
      const primaryOrUniqueColumns = memoizedMetadata
        .filter((col) => col.isPrimary || col.isUnique)
        .map((col) => col.id);

      if (primaryOrUniqueColumns.length === 0) {
        triggerToast('Cannot delete row: no primary or unique keys found.');
        return;
      }

      openAlertDialog({
        title: 'Delete row',
        payload: 'Are you sure you want to delete this row?',
        props: {
          primaryButtonText: 'Delete',
          primaryButtonColor: 'error',
          onPrimaryAction: async () => {
            try {
              await removeRows({
                selectedRows: [row],
                primaryOrUniqueColumns,
              });
              triggerToast('The row has been deleted successfully.');
              await refetch();
              await queryClient.invalidateQueries({
                queryKey: [currentTablePath],
              });
            } catch (err) {
              triggerToast(err.message || 'Unknown error occurred');
            }
          },
        },
      });
    },
    [
      memoizedMetadata,
      openAlertDialog,
      removeRows,
      refetch,
      queryClient,
      currentTablePath,
    ],
  );

  const memoizedColumns = useMemo(() => {
    const cols = columns.map((column) => {
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
    });

    if (isReadOnlyObject || columns.length === 0) {
      return cols;
    }

    const actionsColumn = {
      id: 'actions',
      size: 130,
      header: () => <span className="font-bold">Actions</span>,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              handleCloneClick(row.original);
            }}
            title="Clone row"
            aria-label="Clone row"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              handleEditClick(row);
            }}
            title="Edit row"
            aria-label="Edit row"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(row);
            }}
            title="Delete row"
            aria-label="Delete row"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      enableSorting: false,
      enableResizing: false,
    };

    return [actionsColumn, ...cols];
  }, [
    columns,
    currentTablePath,
    queryClient,
    updateRow,
    isReadOnlyObject,
    handleCloneClick,
    handleEditClick,
    handleDeleteClick,
  ]);

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
      options={{
        manualSorting: true,
        enableMultiSort: false,
      }}
      controls={
        <DataBrowserGridControls
          onInsertRowClick={isReadOnlyObject ? undefined : handleInsertRowClick}
          showRefreshMaterializedViewButton={isMaterializedView}
          onRefreshMaterializedViewClick={handleRefreshMaterializedViewClick}
          isRefreshingMaterializedView={isRefreshingMaterializedView}
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
