import {
  CopyIcon,
  Ellipsis as DotsHorizontalIcon,
  EyeIcon,
  Trash2 as TrashIcon,
} from 'lucide-react';
import { useDialog } from '@/components/common/DialogProvider';
import { Box } from '@/components/ui/v2/Box';
import { IconButton } from '@/components/ui/v2/IconButton';
import { Text } from '@/components/ui/v2/Text';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { FileStoresIcon } from '@/components/ui/v3/icons/FileStoresIcon';
import { DeleteFileStoreModal } from '@/features/orgs/projects/ai/DeleteFileStoreModal';
import { FileStoreForm } from '@/features/orgs/projects/ai/FileStoreForm';
import type { GraphiteFileStore } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/ai/file-stores';
import { copy } from '@/utils/copy';

interface FileStoresListProps {
  /**
   * List of File Stores to be displayed.
   */
  fileStores: GraphiteFileStore[];

  /**
   * Function to be called after a submitting the form for either creating or updating a File Store.
   *
   * @example onDelete={() => refetch()}
   */
  onCreateOrUpdate: () => Promise<unknown>;

  /**
   * Function to be called after a successful delete action.
   *
   */
  onDelete?: () => Promise<unknown>;
}

export default function FileStoresList({
  fileStores,
  onCreateOrUpdate,
  onDelete,
}: FileStoresListProps) {
  const { openDrawer, openDialog, closeDialog } = useDialog();

  const viewFileStore = async (fileStore: GraphiteFileStore) => {
    openDrawer({
      title: fileStore.name,
      component: (
        <FileStoreForm
          id={fileStore.id}
          initialData={{ ...fileStore }}
          onSubmit={() => onCreateOrUpdate()}
        />
      ),
    });
  };

  const deleteFileStore = async (fileStore: GraphiteFileStore) => {
    openDialog({
      component: (
        <DeleteFileStoreModal
          fileStore={fileStore}
          close={closeDialog}
          onDelete={onDelete}
        />
      ),
    });
  };

  return (
    <Box className="flex flex-col">
      {fileStores.map((fileStore) => (
        <Box
          key={fileStore.id}
          className="flex h-[64px] w-full cursor-pointer items-center justify-between space-x-4 border-b-1 px-4 py-2 transition-colors"
          sx={{
            [`&:hover`]: {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <Box
            onClick={() => viewFileStore(fileStore)}
            className="flex w-full flex-row justify-between"
            sx={{ backgroundColor: 'transparent' }}
          >
            <div className="flex flex-1 flex-row items-center space-x-4">
              <FileStoresIcon className="h-5 w-5" />
              <div className="flex flex-col">
                <Text variant="h4" className="font-semibold">
                  {fileStore?.name ?? 'unset'}
                </Text>
                <div className="hidden flex-row items-center space-x-2 md:flex">
                  <Text variant="subtitle1" className="font-mono text-xs">
                    {fileStore.id}
                  </Text>
                  <IconButton
                    variant="borderless"
                    color="secondary"
                    onClick={(event) => {
                      copy(fileStore.id, 'File Store Id');
                      event.stopPropagation();
                    }}
                    aria-label="Service Id"
                  >
                    <CopyIcon className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </div>
          </Box>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                variant="borderless"
                color="secondary"
                aria-label="More options"
                onClick={(event) => event.stopPropagation()}
              >
                <DotsHorizontalIcon />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto p-0">
              <DropdownMenuItem
                onClick={() => viewFileStore(fileStore)}
                className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
              >
                <EyeIcon className="h-4 w-4" />
                <span>View {fileStore?.name}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                onClick={() => deleteFileStore(fileStore)}
              >
                <TrashIcon className="h-4 w-4" />
                <span>Delete {fileStore?.name}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Box>
      ))}
    </Box>
  );
}
