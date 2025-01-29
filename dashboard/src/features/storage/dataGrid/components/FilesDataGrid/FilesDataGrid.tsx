import type { DataGridProps } from '@/components/dataGrid/DataGrid';
import { DataGrid } from '@/components/dataGrid/DataGrid';
import { DataGridBooleanCell } from '@/components/dataGrid/DataGridBooleanCell';
import { DataGridDateCell } from '@/components/dataGrid/DataGridDateCell';
import type { PreviewProps } from '@/components/dataGrid/DataGridPreviewCell';
import { DataGridPreviewCell } from '@/components/dataGrid/DataGridPreviewCell';
import { DataGridTextCell } from '@/components/dataGrid/DataGridTextCell';
import { FilePreviewIcon } from '@/components/ui/v2/icons/FilePreviewIcon';
import { useAppClient } from '@/features/projects/common/hooks/useAppClient';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { FilesDataGridControls } from '@/features/storage/dataGrid/components/FilesDataGridControls';
import { useBuckets } from '@/features/storage/dataGrid/hooks/useBuckets';
import { useFiles } from '@/features/storage/dataGrid/hooks/useFiles';
import { useFilesAggregate } from '@/features/storage/dataGrid/hooks/useFilesAggregate';
import type { Files } from '@/utils/__generated__/graphql';
import { Order_By as OrderBy } from '@/utils/__generated__/graphql';
import { getHasuraAdminSecret } from '@/utils/env';
import { showLoadingToast, triggerToast } from '@/utils/toast';
import debounce from 'lodash.debounce';
import { useRouter } from 'next/router';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { Column, SortingRule } from 'react-table';

export type StoredFile = Files & {
  preview?: PreviewProps;
};

export type FilesDataGridProps = Partial<DataGridProps<StoredFile>>;

export default function FilesDataGrid(props: FilesDataGridProps) {
  const router = useRouter();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const appClient = useAppClient();
  const [searchString, setSearchString] = useState<string | null>(null);
  const [currentOffset, setCurrentOffset] = useState<number | null>(
    parseInt(router.query.page as string, 10) - 1 || 0,
  );
  const [sortBy, setSortBy] = useState<SortingRule<StoredFile>[]>();
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

  const memoizedColumns: Column<StoredFile>[] = useMemo(
    () => [
      {
        Header: 'Preview',
        accessor: 'preview',
        Cell: (cellProps) =>
          DataGridPreviewCell({
            ...cellProps,
            fallbackPreview: (
              <FilePreviewIcon className="h-5 w-5 fill-current" />
            ),
          }),
        minWidth: 80,
        width: 80,
        disableSortBy: true,
        disableResizing: true,
      },
      {
        Header: 'id',
        accessor: 'id',
        isCopiable: true,
        Cell: DataGridTextCell,
        width: 318,
        sortType: 'basic',
        isPrimary: true,
      },
      { Header: 'name', accessor: 'name', width: 200, sortType: 'basic' },
      { Header: 'size', accessor: 'size', width: 80, sortType: 'basic' },
      {
        Header: 'mimeType',
        accessor: 'mimeType',
        width: 120,
        sortType: 'basic',
      },
      {
        Header: 'createdAt',
        accessor: 'createdAt',
        width: 120,
        Cell: DataGridDateCell,
        sortType: 'basic',
      },
      {
        Header: 'updatedAt',
        accessor: 'updatedAt',
        width: 120,
        Cell: DataGridDateCell,
        sortType: 'basic',
      },
      {
        Header: 'bucketId',
        accessor: 'bucketId',
        width: 200,
        sortType: 'basic',
      },
      { Header: 'etag', accessor: 'etag', width: 280, sortType: 'basic' },
      {
        Header: 'isUploaded',
        accessor: 'isUploaded',
        width: 100,
        Cell: DataGridBooleanCell,
        sortType: 'basic',
      },
      {
        Header: 'uploadedByUserId',
        accessor: 'uploadedByUserId',
        width: 318,
        sortType: 'basic',
      },
    ],
    [],
  );

  const memoizedData = useMemo(() => files, [files]);

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

  // no-param-reassign is disabled in this function, because this is the only
  // way to reset the file input's value after the file has been uploaded.
  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const [file] = event.target.files;

    if (!file) {
      // eslint-disable-next-line no-param-reassign
      event.target.value = null;

      return;
    }

    if (!defaultBucket?.id) {
      // eslint-disable-next-line no-param-reassign
      event.target.value = null;

      triggerToast(
        'File cannot be uploaded, because no default bucket is available.',
      );

      return;
    }

    if (file.size > defaultBucket.maxUploadFileSize) {
      // eslint-disable-next-line no-param-reassign
      event.target.value = null;

      triggerToast(
        `File size cannot be larger than the maximum allowed size of ${
          defaultBucket.maxUploadFileSize / 1000000
        } MB.`,
      );

      return;
    }

    let toastId: string;
    let uploaded: boolean;

    setTimeout(() => {
      if (!uploaded) {
        toastId = showLoadingToast(`Uploading ${file.name}...`);
      }
    }, 250);

    try {
      const { fileMetadata, error: fileError } = await appClient.storage
        .setAdminSecret(
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : currentProject.config?.hasura.adminSecret,
        )
        .upload({
          file,
          name: encodeURIComponent(file.name),
          bucketId: defaultBucket.id,
        });

      uploaded = true;

      if (toastId) {
        toast.remove(toastId);
      }

      if (fileError) {
        throw new Error(fileError.message);
      }

      if (!fileMetadata) {
        throw new Error('File metadata is missing.');
      }

      const fileId =
        'processedFiles' in fileMetadata
          ? fileMetadata.processedFiles[0]?.id
          : fileMetadata.id;

      triggerToast(`File has been uploaded successfully (${fileId})`);

      await refetchFilesAndAggregate();
    } catch (uploadError) {
      if (toastId) {
        toast.remove(toastId);
      }

      triggerToast(uploadError.message);
    }

    // eslint-disable-next-line no-param-reassign
    event.target.value = null;
  }

  if (error) {
    throw error;
  }

  const handleSort = useCallback((args: SortingRule<StoredFile>[]) => {
    setSortBy(args);
  }, []);

  return (
    <DataGrid
      columns={memoizedColumns}
      data={memoizedData}
      allowSelection
      allowResize
      allowSort
      emptyStateMessage={emptyStateMessage}
      onSort={handleSort}
      loading={loading}
      options={{
        manualSortBy: true,
        disableMultiSort: true,
        autoResetSortBy: false,
        autoResetSelectedRows: false,
        autoResetResize: false,
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
      {...props}
    />
  );
}
