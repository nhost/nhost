import type { DataGridProps } from '@/components/common/DataGrid';
import DataGrid from '@/components/common/DataGrid';
import DataGridBooleanCell from '@/components/common/DataGridBooleanCell';
import DataGridDateCell from '@/components/common/DataGridDateCell';
import DataGridNumericCell from '@/components/common/DataGridNumericCell';
import DataGridTextCell from '@/components/common/DataGridTextCell';
import { useDialog } from '@/components/common/DialogProvider';
import InlineCode from '@/components/common/InlineCode';
import DataBrowserEmptyState from '@/components/dataBrowser/DataBrowserEmptyState';
import DataBrowserGridControls from '@/components/dataBrowser/DataBrowserGridControls';
import useDeleteColumnWithToastMutation from '@/hooks/dataBrowser/useDeleteColumnMutation/useDeleteColumnWithToastMutation';
import useTableQuery from '@/hooks/dataBrowser/useTableQuery';
import type { UpdateRecordVariables } from '@/hooks/dataBrowser/useUpdateRecordMutation';
import useUpdateRecordWithToastMutation from '@/hooks/dataBrowser/useUpdateRecordMutation/useUpdateRecordWithToastMutation';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import useTablePath from '@/hooks/useTablePath';
import type {
  DataBrowserGridColumn,
  NormalizedQueryDataRow,
} from '@/types/dataBrowser';
import KeyIcon from '@/ui/v2/icons/KeyIcon';
import normalizeDefaultValue from '@/utils/dataBrowser/normalizeDefaultValue';
import {
  POSTGRESQL_CHARACTER_TYPES,
  POSTGRESQL_DATE_TIME_TYPES,
  POSTGRESQL_JSON_TYPES,
  POSTGRESQL_NUMERIC_TYPES,
} from '@/utils/dataBrowser/postgresqlConstants';
import { isSchemaLocked } from '@/utils/dataBrowser/schemaHelpers';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

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
        {column.is_primary && <KeyIcon className="text-sm" />}

        <span className="truncate font-bold" title={column.column_name}>
          {column.column_name}
        </span>

        <InlineCode>
          {column.udt_name}
          {column.character_maximum_length
            ? `(${column.character_maximum_length})`
            : null}
        </InlineCode>
      </div>
    ),
    id: column.column_name,
    accessor: column.column_name,
    sortType: 'basic',
    width: 200,
    isEditable,
    type: 'text',
    specificType: column.udt_name,
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

  if (POSTGRESQL_NUMERIC_TYPES.includes(column.data_type)) {
    return {
      ...defaultColumnConfiguration,
      type: 'number',
      width: 200,
      Cell: DataGridNumericCell,
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
      width: 200,
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
  const dataGridRef = useRef<HTMLDivElement>();

  const queryClient = useQueryClient();
  const {
    query: { page, dataSourceSlug, schemaSlug, tableSlug, ...query },
    ...router
  } = useRouter();
  const currentTablePath = useTablePath();
  const isSchemaEditable = !isSchemaLocked(schemaSlug as string);
  const { openDrawer, openAlertDialog } = useDialog();

  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const isGitHubConnected = !!currentApplication?.githubRepository;

  const limit = 25;
  const [currentOffset, setCurrentOffset] = useState<number | null>(
    parseInt(page as string, 10) - 1 || 0,
  );

  const [removableColumnId, setRemovableColumnId] = useState<string>();
  const [optimisticlyRemovedColumnId, setOptimisticlyRemovedColumnId] =
    useState<string>();

  const { mutateAsync: updateRow } = useUpdateRecordWithToastMutation();
  const { mutateAsync: deleteColumn } = useDeleteColumnWithToastMutation();

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
    columns: [],
    rows: [],
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
      columns
        .map((column) => ({
          ...createDataGridColumn(column, isSchemaEditable),
          onCellEdit: async (variables: UpdateRecordVariables) => {
            const result = await updateRow(variables);
            await queryClient.invalidateQueries([currentTablePath]);

            return result;
          },
          isDisabled: removableColumnId === column.column_name,
        }))
        .filter((column) => column.id !== optimisticlyRemovedColumnId),
    [
      columns,
      currentTablePath,
      isSchemaEditable,
      optimisticlyRemovedColumnId,
      queryClient,
      removableColumnId,
      updateRow,
    ],
  );

  const memoizedData = useMemo(() => rows, [rows]);

  async function handleInsertRowClick() {
    openDrawer('CREATE_RECORD', {
      title: 'Insert a New Row',
      payload: {
        columns: memoizedColumns,
        onSubmit: refetch,
      },
    });
  }

  async function handleInsertColumnClick() {
    openDrawer('CREATE_COLUMN', {
      title: 'Insert a New Column',
      payload: {
        onSubmit: refetch,
      },
    });
  }

  async function handleEditColumnClick(
    column: DataBrowserGridColumn<NormalizedQueryDataRow>,
  ) {
    openDrawer('EDIT_COLUMN', {
      title: 'Edit Column',
      payload: {
        column,
        onSubmit: () => queryClient.refetchQueries([currentTablePath]),
      },
    });
  }

  async function handleColumnDeleteConfirmation(
    column: DataBrowserGridColumn<NormalizedQueryDataRow>,
  ) {
    try {
      // We are greying out and disabling it in the grid
      setRemovableColumnId(column.id);
      await deleteColumn({ column });

      // Note: At this point we can optimisticly assume that the column was
      // removed, so we can improve the UX by removing it from the grid right
      // away, without waiting for the refetch to succeed.
      setOptimisticlyRemovedColumnId(column.id);
      await queryClient.refetchQueries([currentTablePath]);
    } finally {
      setRemovableColumnId(undefined);
      setOptimisticlyRemovedColumnId(undefined);
    }
  }

  async function handleColumnRemoveClick(
    column: DataBrowserGridColumn<NormalizedQueryDataRow>,
  ) {
    openAlertDialog({
      title: 'Delete column',
      payload: (
        <span>
          Are you sure you want to delete the{' '}
          <strong className="break-all">{column.id}</strong> column?
        </span>
      ),
      props: {
        primaryButtonText: 'Delete',
        primaryButtonColor: 'error',
        onPrimaryAction: () => handleColumnDeleteConfirmation(column),
      },
    });
  }

  if (metadata?.schemaNotFound) {
    return (
      <DataBrowserEmptyState
        title="Schema not found"
        description={
          <span>
            Schema{' '}
            <InlineCode className="bg-gray-200 bg-opacity-80 px-1.5 text-sm">
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
            <InlineCode className="bg-gray-200 bg-opacity-80 px-1.5 text-sm">
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
      onInsertRow={isSchemaEditable ? handleInsertRowClick : undefined}
      onInsertColumn={isSchemaEditable ? handleInsertColumnClick : undefined}
      onEditColumn={isSchemaEditable ? handleEditColumnClick : undefined}
      onRemoveColumn={isSchemaEditable ? handleColumnRemoveClick : undefined}
      options={{
        manualSortBy: true,
        disableMultiSort: true,
        autoResetSortBy: false,
        autoResetSelectedRows: false,
        autoResetResize: false,
      }}
      headerProps={{
        componentsProps: {
          editActionProps: { disabled: isGitHubConnected },
          deleteActionProps: { disabled: isGitHubConnected },
          insertActionProps: { disabled: isGitHubConnected },
        },
      }}
      controls={
        <DataBrowserGridControls
          onInsertColumnClick={
            isSchemaEditable ? handleInsertColumnClick : undefined
          }
          onInsertRowClick={isSchemaEditable ? handleInsertRowClick : undefined}
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
