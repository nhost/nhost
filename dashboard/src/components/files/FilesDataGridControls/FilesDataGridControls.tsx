import type { DataGridPaginationProps } from '@/components/common/DataGridPagination';
import DataGridPagination from '@/components/common/DataGridPagination';
import { useDialog } from '@/components/common/DialogProvider';
import { useAppClient } from '@/hooks/useAppClient';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import useDataGridConfig from '@/hooks/useDataGridConfig';
import type { FileUploadButtonProps } from '@/ui/FileUploadButton';
import FileUploadButton from '@/ui/FileUploadButton';
import type { BoxProps } from '@/ui/v2/Box';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Chip from '@/ui/v2/Chip';
import { triggerToast } from '@/utils/toast';
import type { Files } from '@/utils/__generated__/graphql';
import { useState } from 'react';
import type { Row } from 'react-table';
import { twMerge } from 'tailwind-merge';

export type FilterProps = BoxProps<'input'>;

export interface FilesDataGridControlsProps extends BoxProps {
  paginationProps?: DataGridPaginationProps;
  fileUploadProps?: FileUploadButtonProps;
  filterProps?: FilterProps;
  refetchData?: () => Promise<any>;
}

export default function FilesDataGridControls({
  className,
  paginationProps,
  fileUploadProps,
  filterProps,
  refetchData,
  ...props
}: FilesDataGridControlsProps) {
  const { openAlertDialog } = useDialog();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const appClient = useAppClient();
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { className: paginationClassName, ...restPaginationProps } =
    paginationProps || ({} as DataGridPaginationProps);
  const { className: fileUploadClassName, ...restFileUploadProps } =
    fileUploadProps || ({} as FileUploadButtonProps);
  const { className: filterClassName, ...restFilterProps } =
    filterProps || ({} as FilterProps);

  const { selectedFlatRows: selectedFiles, toggleAllRowsSelected } =
    useDataGridConfig<Files>();

  // note: this array ensures that there won't be a glitch with the submit
  // button when files are being deleted
  const [selectedFilesBeforeDelete, setSelectedFilesBeforeDelete] = useState<
    Row<Files>[]
  >([]);

  const numberOfSelectedFiles =
    selectedFilesBeforeDelete.length || selectedFiles?.length;

  async function handleFileDelete() {
    if (!selectedFiles || selectedFiles.length === 0) {
      return;
    }

    setSelectedFilesBeforeDelete(selectedFiles);
    setDeleteLoading(true);

    try {
      const storageWithAdminSecret = appClient.storage.setAdminSecret(
        process.env.NEXT_PUBLIC_ENV === 'dev'
          ? 'nhost-admin-secret'
          : currentApplication.hasuraGraphqlAdminSecret,
      );

      // note: this is not an optimal solution, but we don't have a better way
      // to batch remove files for now
      const response = await Promise.allSettled(
        selectedFiles.map((file) =>
          storageWithAdminSecret.delete({ fileId: file.original.id }),
        ),
      );

      const failedFiles = response.filter(
        (content) =>
          content.status === 'rejected' || Boolean(content.value.error),
      );

      if (failedFiles.length > 0) {
        triggerToast(
          `Failed to delete ${failedFiles.length} ${
            failedFiles.length === 1 ? 'file' : 'files'
          }`,
        );
      } else {
        triggerToast(
          selectedFiles.length === 1
            ? `The file was successfully deleted.`
            : `${selectedFiles.length} files were successfully deleted.`,
        );
      }

      toggleAllRowsSelected(false);

      if (refetchData) {
        await refetchData();
      }
    } catch (error) {
      triggerToast(error.message || 'Unknown error occurred');
    }

    setDeleteLoading(false);
  }

  return (
    <Box
      className={twMerge('sticky top-0 z-20 border-b-1 p-2', className)}
      {...props}
    >
      {numberOfSelectedFiles > 0 ? (
        <div className="mx-auto grid grid-flow-col place-content-start items-center gap-3">
          <Chip
            color="info"
            size="small"
            label={`${numberOfSelectedFiles} selected`}
          />

          <Button
            variant="borderless"
            color="error"
            size="small"
            loading={deleteLoading}
            onClick={() =>
              openAlertDialog({
                title:
                  numberOfSelectedFiles === 1
                    ? 'Delete file'
                    : `Delete ${numberOfSelectedFiles} files`,
                payload: `Are you sure you want to delete the selected ${
                  numberOfSelectedFiles === 1 ? 'file' : 'files'
                }?`,
                props: {
                  primaryButtonText:
                    numberOfSelectedFiles === 1
                      ? 'Delete'
                      : `Delete ${numberOfSelectedFiles} Files`,
                  primaryButtonColor: 'error',
                  onPrimaryAction: handleFileDelete,
                  TransitionProps: {
                    onExited: () => setSelectedFilesBeforeDelete([]),
                  },
                },
              })
            }
          >
            Delete
          </Button>
        </div>
      ) : (
        <div className="mx-auto grid w-full grid-cols-12 gap-2">
          <Box
            component="input"
            className={twMerge(
              'col-span-12 rounded-sm p-2 font-display text-sm+ leading-4 xs+:col-span-12 md:col-span-9 xl:col-span-10 outline-none',
              filterClassName,
            )}
            sx={{ backgroundColor: 'grey.200' }}
            {...restFilterProps}
          />

          <div className="col-span-12 grid grid-flow-col gap-2 md:col-span-3 xl:col-span-2">
            <DataGridPagination
              className={twMerge('col-span-6', paginationClassName)}
              {...restPaginationProps}
            />

            <FileUploadButton
              className={twMerge(
                'col-span-6 self-stretch font-medium',
                fileUploadClassName,
              )}
              {...restFileUploadProps}
            >
              Upload
            </FileUploadButton>
          </div>
        </div>
      )}
    </Box>
  );
}
