import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/router';
import type { ChangeEvent } from 'react';
import { useMemo } from 'react';
import toast from 'react-hot-toast';
import { ReadOnlyToggle } from '@/components/presentational/ReadOnlyToggle';
import { Button } from '@/components/ui/v3/button';
import { usePageBoundsRedirect } from '@/features/orgs/projects/common/hooks/usePageBoundsRedirect';
import { useDataGridQueryParams } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { DataGridProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { DataGrid } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { DataGridDateCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridDateCell';
import type { PreviewProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPreviewCell';
import { DataGridPreviewCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPreviewCell';
import { FileIcon } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPreviewCell/icons';
import { DataGridTextCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridTextCell';
import { FilesDataGridControls } from '@/features/orgs/projects/storage/dataGrid/components/FilesDataGridControls';
import { PreviewHeader } from '@/features/orgs/projects/storage/dataGrid/components/PreviewHeader';
import { useFiles } from '@/features/orgs/projects/storage/dataGrid/hooks/useFiles';
import { useFilesAggregate } from '@/features/orgs/projects/storage/dataGrid/hooks/useFilesAggregate';
import { filtersToFilesWhere } from '@/features/orgs/projects/storage/dataGrid/utils/filtersToFilesWhere';
import { isNotEmptyValue } from '@/lib/utils';
import type { Files, GetBucketQuery } from '@/utils/__generated__/graphql';
import { Order_By as OrderBy } from '@/utils/__generated__/graphql';
import { getHasuraAdminSecret } from '@/utils/env';
import { showLoadingToast, triggerToast } from '@/utils/toast';

export type StoredFile = Omit<Files, 'bucket'> & {
  preview: PreviewProps;
};

type Bucket = NonNullable<GetBucketQuery['bucket']>;

export type FilesDataGridProps = {
  bucket: Bucket;
} & Partial<DataGridProps<StoredFile>>;

export default function FilesDataGrid({
  bucket,
  ...dataGridProps
}: FilesDataGridProps) {
  const columns = useMemo<ColumnDef<StoredFile>[]>(
    () => [
      {
        id: 'preview-column',
        header: PreviewHeader,
        accessorKey: 'preview',
        cell: (props) => {
          const { getValue, row } = props as CellContext<
            StoredFile,
            PreviewProps
          >;
          const value = getValue();

          return (
            <DataGridPreviewCell
              key={row.original.id}
              {...value}
              isDisabled={!row.original.isUploaded}
              fallbackPreview={<FileIcon className="h-5 w-5" />}
              downloadExpiration={bucket.downloadExpiration}
            />
          );
        },
        minSize: 120,
        size: 120,
        enableSorting: false,
        enableResizing: false,
        enableColumnFilter: false,
      },
      {
        header: 'id',
        accessorKey: 'id',
        meta: { dataType: 'uuid' },
        cell: (props) => (
          <DataGridTextCell {...(props as CellContext<StoredFile, string>)} />
        ),
        size: 318,
      },
      {
        header: 'name',
        accessorKey: 'name',
        meta: { dataType: 'text' },
        size: 200,
      },
      {
        header: 'size',
        accessorKey: 'size',
        meta: { dataType: 'integer' },
        size: 80,
      },
      {
        header: 'mimeType',
        accessorKey: 'mimeType',
        meta: { dataType: 'text' },
        size: 120,
      },
      {
        header: 'createdAt',
        accessorKey: 'createdAt',
        meta: { dataType: 'timestamptz' },
        size: 120,
        cell: (props) => (
          <DataGridDateCell {...(props as CellContext<StoredFile, string>)} />
        ),
      },
      {
        header: 'updatedAt',
        accessorKey: 'updatedAt',
        meta: { dataType: 'timestamptz' },
        size: 120,
        cell: (props) => (
          <DataGridDateCell {...(props as CellContext<StoredFile, string>)} />
        ),
      },
      {
        header: 'bucketId',
        accessorKey: 'bucketId',
        size: 200,
        enableColumnFilter: false,
      },
      {
        header: 'etag',
        accessorKey: 'etag',
        meta: { dataType: 'text' },
        size: 280,
      },
      {
        header: 'isUploaded',
        accessorKey: 'isUploaded',
        meta: { dataType: 'boolean' },
        size: 100,
        cell: ({ getValue }) => (
          <ReadOnlyToggle checked={getValue<boolean>()} />
        ),
      },
      {
        header: 'uploadedByUserId',
        accessorKey: 'uploadedByUserId',
        meta: { dataType: 'uuid' },
        size: 318,
      },
    ],
    [bucket.downloadExpiration],
  );
  const router = useRouter();
  const { project } = useProject();
  const appClient = useAppClient();
  const {
    appliedFilters,
    sortBy,
    setSortBy,
    currentOffset,
    setAppliedFilters,
  } = useDataGridQueryParams();
  const limit = 10;
  const where = filtersToFilesWhere(appliedFilters, bucket.id);

  const {
    files,
    loading,
    error,
    refetch: refetchFiles,
  } = useFiles({
    where,
    limit,
    offset: currentOffset * limit,
    orderBy:
      sortBy && sortBy.length > 0
        ? sortBy.reduce(
            (accumulator, currentSortByField) => ({
              ...accumulator,
              [currentSortByField.id]: currentSortByField.desc
                ? OrderBy.Desc
                : OrderBy.Asc,
            }),
            {},
          )
        : { updatedAt: OrderBy.Desc },
  });

  const { numberOfFiles, refetch: refetchFilesAggregate } = useFilesAggregate({
    where,
  });

  const numberOfPages = numberOfFiles ? Math.ceil(numberOfFiles / limit) : 0;
  const currentPage = Math.min(currentOffset + 1, numberOfPages);

  usePageBoundsRedirect(numberOfPages, loading);

  const hasFilterError = !!error && appliedFilters.length > 0;
  const memoizedData = useMemo(
    () => (hasFilterError ? [] : (files as StoredFile[])),
    [hasFilterError, files],
  );

  async function refetchFilesAndAggregate() {
    await refetchFiles();
    await refetchFilesAggregate();
  }

  async function handleOpenPrevPage() {
    const nextOffset = Math.max(currentOffset - 1, 0);

    await router.push({
      pathname: router.pathname,
      query: { ...router.query, page: nextOffset + 1 },
    });
  }

  async function handleOpenNextPage() {
    const nextOffset = Math.min(currentOffset + 1, numberOfPages - 1);

    await router.push({
      pathname: router.pathname,
      query: { ...router.query, page: nextOffset + 1 },
    });
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const [file] = event.target.files!;

    if (!file) {
      // biome-ignore lint/style/noParameterAssign: reset file input's value
      event.target.value = '';

      return;
    }

    if (!bucket?.id) {
      // biome-ignore lint/style/noParameterAssign: reset file input's value
      event.target.value = '';

      triggerToast('File cannot be uploaded, because no bucket is available.');

      return;
    }
    if (file.size > bucket.maxUploadFileSize) {
      // biome-ignore lint/style/noParameterAssign: reset file input's value
      event.target.value = '';

      triggerToast(
        `File size cannot be larger than the maximum allowed size of ${
          bucket.maxUploadFileSize / 1000000
        } MB.`,
      );

      return;
    }

    const toastId = showLoadingToast(`Uploading ${file.name}...`);
    try {
      const uploadResponse = await appClient.storage.uploadFiles(
        {
          'bucket-id': bucket.id,
          'file[]': [file],
          'metadata[]': [
            {
              name: encodeURIComponent(file.name),
            },
          ],
        },
        {
          headers: {
            'x-hasura-admin-secret':
              process.env.NEXT_PUBLIC_ENV === 'dev'
                ? getHasuraAdminSecret()
                : project!.config!.hasura.adminSecret,
          },
        },
      );
      if (isNotEmptyValue(uploadResponse.body.processedFiles)) {
        const fileMetadata = uploadResponse.body.processedFiles?.[0];

        if (toastId) {
          toast.remove(toastId);
        }

        if (fileMetadata) {
          const fileId = fileMetadata.id;

          triggerToast(`File has been uploaded successfully (${fileId})`);

          await refetchFilesAndAggregate();
        } else {
          throw new Error('File metadata is missing.');
        }
      }
    } catch (uploadError) {
      if (toastId) {
        toast.remove(toastId);
      }

      triggerToast(uploadError.message);
    }

    // biome-ignore lint/style/noParameterAssign: reset file input's value
    event.target.value = '';
  }

  if (error && !hasFilterError) {
    throw error;
  }

  const emptyStateMessage = hasFilterError ? (
    <p className="text-destructive text-xs">
      Error: {error.message} -{' '}
      <Button
        variant="link"
        className="pl-0 text-destructive text-xs hover:no-underline"
        onClick={() => setAppliedFilters([])}
      >
        Click here to reset your filters
      </Button>
    </p>
  ) : appliedFilters.length > 0 ? (
    <p className="text-xs">
      No matches found -{' '}
      <Button
        variant="link"
        className="pl-0 text-xs hover:no-underline"
        onClick={() => setAppliedFilters([])}
      >
        Click here to reset your filters
      </Button>
    </p>
  ) : (
    'No files are uploaded yet.'
  );

  return (
    <DataGrid
      columns={columns}
      data={memoizedData}
      allowSelection
      allowResize
      allowSort
      sorting={sortBy}
      emptyStateMessage={emptyStateMessage}
      onSortingChange={setSortBy}
      loading={loading}
      enableRowSelection={(row) => !!row.original.isUploaded}
      options={{
        manualSorting: true,
        enableMultiSort: false,
        autoResetPageIndex: false,
      }}
      controls={
        <FilesDataGridControls
          paginationProps={{
            currentPage: Math.max(currentPage, 1),
            totalPages: Math.max(numberOfPages, 1),
            onOpenPrevPage: handleOpenPrevPage,
            onOpenNextPage: handleOpenNextPage,
          }}
          fileUploadProps={{
            onChange: handleFileUpload,
          }}
          storageKey={`storage:${bucket.id}`}
          isFetching={loading}
          refetchData={refetchFilesAndAggregate}
        />
      }
      isRowDisabled={(row) => !row.original.isUploaded}
      {...dataGridProps}
    />
  );
}
