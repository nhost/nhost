import { useDialog } from '@/components/common/DialogProvider';
import { Box } from '@/components/ui/v2/Box';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { IconButton } from '@/components/ui/v2/IconButton';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { DotsHorizontalIcon } from '@/components/ui/v2/icons/DotsHorizontalIcon';
import { FileStoresIcon } from '@/components/ui/v2/icons/FileStoresIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { Text } from '@/components/ui/v2/Text';
import { DeleteFileStoreModal } from '@/features/orgs/projects/ai/DeleteFileStoreModal';
import { FileStoreForm } from '@/features/orgs/projects/ai/FileStoreForm';
import { type GraphiteFileStore } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/ai/file-stores';
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
  onCreateOrUpdate?: () => Promise<any>;

  /**
   * Function to be called after a successful delete action.
   *
   */
  onDelete?: () => Promise<any>;
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

          <Dropdown.Root>
            <Dropdown.Trigger
              asChild
              hideChevron
              onClick={(event) => event.stopPropagation()}
            >
              <IconButton
                variant="borderless"
                color="secondary"
                aria-label="More options"
                onClick={(event) => event.stopPropagation()}
              >
                <DotsHorizontalIcon />
              </IconButton>
            </Dropdown.Trigger>
            <Dropdown.Content
              menu
              PaperProps={{ className: 'w-auto' }}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <Dropdown.Item
                onClick={() => viewFileStore(fileStore)}
                className="z-50 grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
              >
                <UserIcon className="h-4 w-4" />
                <Text className="font-medium">View {fileStore?.name}</Text>
              </Dropdown.Item>
              <Divider component="li" />
              <Dropdown.Item
                className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                sx={{ color: 'error.main' }}
                onClick={() => deleteFileStore(fileStore)}
              >
                <TrashIcon className="h-4 w-4" />
                <Text className="font-medium" color="error">
                  Delete {fileStore?.name}
                </Text>
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Root>
        </Box>
      ))}
    </Box>
  );
}
