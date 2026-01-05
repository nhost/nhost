import { useDialog } from '@/components/common/DialogProvider';
import { Badge } from '@/components/ui/v3/badge';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { Input, type InputProps } from '@/components/ui/v3/input';
import { DataGridTableViewConfigurationPopover } from '@/features/orgs/projects/common/components/DataGridTableViewConfigurationPopover';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import type { DataGridPaginationProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPagination';
import { DataGridPagination } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPagination';
import type { FileUploadButtonProps } from '@/features/orgs/projects/storage/dataGrid/components/FileUploadButton';
import { FileUploadButton } from '@/features/orgs/projects/storage/dataGrid/components/FileUploadButton';
import { cn } from '@/lib/utils';
import type { Files } from '@/utils/__generated__/graphql';
import { getHasuraAdminSecret } from '@/utils/env';
import { triggerToast } from '@/utils/toast';
import type { PropsWithoutRef } from 'react';
import { useState } from 'react';
import type { Row } from 'react-table';
import { twMerge } from 'tailwind-merge';

export type FilterProps = PropsWithoutRef<InputProps>;

export interface FilesDataGridControlsProps {
  paginationProps?: DataGridPaginationProps;
  fileUploadProps?: FileUploadButtonProps;
  filterProps?: FilterProps;
  refetchData?: () => Promise<unknown>;
  className?: string;
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
    <div
      className={cn('box sticky top-0 z-20 border-b-1 p-2', className)}
      {...props}
    >
      {numberOfSelectedFiles > 0 ? (
        <div className="flex h-[40px] items-center justify-start gap-2">
          <Badge
            variant="secondary"
            className="!bg-[#ebf3ff] text-primary dark:!bg-[#1b2534]"
          >
            {`${numberOfSelectedFiles} selected`}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            className="border-none text-destructive hover:bg-[#f131541a] hover:text-destructive"
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
        <div className="flex w-full flex-grow gap-3">
          <Input
            wrapperClassName={cn('w-full', filterClassName)}
            {...restFilterProps}
          />

          <div className="flex flex-shrink-0 gap-3">
            <DataGridPagination
              className={twMerge('col-span-6', paginationClassName)}
              {...restPaginationProps}
            />
            <DataGridTableViewConfigurationPopover />
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
    </div>
  );
}
