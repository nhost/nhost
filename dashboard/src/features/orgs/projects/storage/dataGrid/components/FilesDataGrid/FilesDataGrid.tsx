import type {
  CellContext,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import debounce from 'lodash.debounce';
import { useRouter } from 'next/router';
import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ReadOnlyToggle } from '@/components/presentational/ReadOnlyToggle';
import { FilePreviewIcon } from '@/components/ui/v2/icons/FilePreviewIcon';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { DataGridProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { DataGrid } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { DataGridDateCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridDateCell';
import type { PreviewProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPreviewCell';
import { DataGridPreviewCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPreviewCell';
import { DataGridTextCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridTextCell';
import { FilesDataGridControls } from '@/features/orgs/projects/storage/dataGrid/components/FilesDataGridControls';
import { PreviewHeader } from '@/features/orgs/projects/storage/dataGrid/components/PreviewHeader';
import { useBuckets } from '@/features/orgs/projects/storage/dataGrid/hooks/useBuckets';
import { useFiles } from '@/features/orgs/projects/storage/dataGrid/hooks/useFiles';
import { useFilesAggregate } from '@/features/orgs/projects/storage/dataGrid/hooks/useFilesAggregate';
import { isNotEmptyValue } from '@/lib/utils';
import type { Files } from '@/utils/__generated__/graphql';
import { Order_By as OrderBy } from '@/utils/__generated__/graphql';
import { getHasuraAdminSecret } from '@/utils/env';
import { showLoadingToast, triggerToast } from '@/utils/toast';

export type StoredFile = Omit<Files, 'bucket'> & {
  preview: PreviewProps;
};

export type FilesDataGridProps = Partial<DataGridProps<StoredFile>>;

const columns: ColumnDef<StoredFile>[] = [
  {
    id: 'preview-column',
    header: PreviewHeader,
    accessorKey: 'preview',
    cell: (props) => {
      const { getValue, row } = props as CellContext<StoredFile, PreviewProps>;

      return (
        <DataGridPreviewCell
          isDisabled={!row.original.isUploaded}
          fallbackPreview={<FilePreviewIcon className="h-5 w-5 fill-current" />}
          getValue={getValue}
        />
      );
    },
    minSize: 120,
    size: 120,
    enableSorting: false,
    enableResizing: false,
  },
  {
    header: 'id',
    accessorKey: 'id',
    cell: (props) => (
      <DataGridTextCell {...(props as CellContext<StoredFile, string>)} />
    ),
    size: 318,
    meta: {
      isPrimary: true,
    },
  },
  {
    header: 'name',
    accessorKey: 'name',
    size: 200,
  },
  {
    header: 'size',
    accessorKey: 'size',
    size: 80,
  },
  {
    header: 'mimeType',
    accessorKey: 'mimeType',
    size: 120,
  },
  {
    header: 'createdAt',
    accessorKey: 'createdAt',
    size: 120,
    cell: (props) => (
      <DataGridDateCell {...(props as CellContext<StoredFile, string>)} />
    ),
  },
  {
    header: 'updatedAt',
    accessorKey: 'updatedAt',
    size: 120,
    cell: (props) => (
      <DataGridDateCell {...(props as CellContext<StoredFile, string>)} />
    ),
  },
  {
    header: 'bucketId',
    accessorKey: 'bucketId',
    size: 200,
  },
  { header: 'etag', accessorKey: 'etag', size: 280 },
  {
    header: 'isUploaded',
    accessorKey: 'isUploaded',
    size: 100,
    cell: ({ getValue }) => <ReadOnlyToggle checked={getValue<boolean>()} />,
  },
  {
    header: 'uploadedByUserId',
    accessorKey: 'uploadedByUserId',
    size: 318,
  },
];

export default function FilesDataGrid(props: FilesDataGridProps) {
  const router = useRouter();
  const { project } = useProject();
  const appClient = useAppClient();
  const [searchString, setSearchString] = useState('');
  const [currentOffset, setCurrentOffset] = useState<number>(
    parseInt(router.query.page as string, 10) - 1 || 0,
  );
  const [sortBy, setSortBy] = useState<SortingState>([]);
  const limit = 10;
  const emptyStateMessage = searchString
    ? 'No search results found.'
    : 'No files are uploaded yet.';

  const { defaultBucket } = useBuckets();

  const {
    files,
    loading,
    error,
    refetch: refetchFiles,
  } = useFiles({
    searchString,
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
    searchString,
  });

  const numberOfPages = numberOfFiles ? Math.ceil(numberOfFiles / limit) : 0;
  const currentPage = Math.min(currentOffset + 1, numberOfPages);

  const handleSearchStringChange = useMemo(
    () =>
      debounce((event: ChangeEvent<HTMLInputElement>) => {
        setCurrentOffset(0);
        setSearchString(event.target.value);
      }, 500),
    [],
  );

  useEffect(
    () => () => handleSearchStringChange.cancel(),
    [handleSearchStringChange],
  );

  useEffect(() => {
    if (
      !loading &&
      router.query.page &&
      typeof router.query.page === 'string'
    ) {
      const { page } = router.query;
      const pageNumber = parseInt(page, 10);
      const newOffset = Math.max(
        Math.min(pageNumber - 1, numberOfPages - 1),
        0,
      );

      if (currentOffset !== newOffset) {
        setCurrentOffset(newOffset);
      }
    }
  }, [router.query, loading, numberOfPages, currentOffset]);

  const memoizedData = useMemo(() => files as StoredFile[], [files]);

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

    setCurrentOffset(nextOffset);
  }

  async function handleOpenNextPage() {
    const nextOffset = Math.min(currentOffset + 1, numberOfPages - 1);

    await router.push({
      pathname: router.pathname,
      query: { ...router.query, page: nextOffset + 1 },
    });

    setCurrentOffset(nextOffset);
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const [file] = event.target.files!;

    if (!file) {
      // biome-ignore lint/style/noParameterAssign: reset file input's value
      event.target.value = '';

      return;
    }

    if (!defaultBucket?.id) {
      // biome-ignore lint/style/noParameterAssign: reset file input's value
      event.target.value = '';

      triggerToast(
        'File cannot be uploaded, because no default bucket is available.',
      );

      return;
    }

    if (file.size > defaultBucket.maxUploadFileSize) {
      // biome-ignore lint/style/noParameterAssign: reset file input's value
      event.target.value = '';

      triggerToast(
        `File size cannot be larger than the maximum allowed size of ${
          defaultBucket.maxUploadFileSize / 1000000
        } MB.`,
      );

      return;
    }

    const toastId = showLoadingToast(`Uploading ${file.name}...`);
    try {
      const uploadResponse = await appClient.storage.uploadFiles(
        {
          'bucket-id': defaultBucket.id,
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

  if (error) {
    throw error;
  }

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
          filterProps={{
            defaultValue: searchString,
            onChange: handleSearchStringChange,
            placeholder: 'Filter and search...',
          }}
          refetchData={refetchFilesAndAggregate}
        />
      }
      isRowDisabled={(row) => !row.original.isUploaded}
      {...props}
    />
  );
}
