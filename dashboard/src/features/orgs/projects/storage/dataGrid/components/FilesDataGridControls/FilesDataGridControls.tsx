import { useDialog } from '@/components/common/DialogProvider';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Chip } from '@/components/ui/v2/Chip';
import type { InputProps } from '@/components/ui/v2/Input';
import { Input } from '@/components/ui/v2/Input';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import type { DataGridPaginationProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPagination';
import { DataGridPagination } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPagination';
import type { FileUploadButtonProps } from '@/features/orgs/projects/storage/dataGrid/components/FileUploadButton';
import { FileUploadButton } from '@/features/orgs/projects/storage/dataGrid/components/FileUploadButton';
import type { Files } from '@/utils/__generated__/graphql';
import { getHasuraAdminSecret } from '@/utils/env';
import { triggerToast } from '@/utils/toast';
import type { PropsWithoutRef } from 'react';
import { useState } from 'react';
import type { Row } from 'react-table';
import { twMerge } from 'tailwind-merge';

export type FilterProps = PropsWithoutRef<InputProps>;

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
  const { project } = useProject();
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
      await Promise.allSettled(
        selectedFiles.map((file) =>
          appClient.storage.deleteFile(file.original.id, {
            headers: {
              'x-hasura-admin-secret':
                process.env.NEXT_PUBLIC_ENV === 'dev'
                  ? getHasuraAdminSecret()
                  : project!.config!.hasura.adminSecret,
            },
          }),
        ),
      );
      triggerToast(
        selectedFiles.length === 1
          ? `The file was successfully deleted.`
          : `${selectedFiles.length} files were successfully deleted.`,
      );

      toggleAllRowsSelected(false);

      if (refetchData) {
        await refetchData();
      }
    } catch (error) {
      triggerToast(error.message || 'Unknown error occurred');
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <Box
      className={twMerge('sticky top-0 z-20 border-b-1 p-2', className)}
      {...props}
    >
      {numberOfSelectedFiles > 0 ? (
        <div className="mx-auto grid h-[40px] grid-flow-col items-center justify-start gap-2">
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
          <Input
            className={twMerge(
              'col-span-12 xs+:col-span-12 md:col-span-9 xl:col-span-10',
              filterClassName,
            )}
            fullWidth
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
