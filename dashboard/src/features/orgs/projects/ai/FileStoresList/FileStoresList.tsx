import {
  CopyIcon,
  Ellipsis as DotsHorizontalIcon,
  EyeIcon,
  Trash2 as TrashIcon,
} from 'lucide-react';
import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { FileStoresIcon } from '@/components/ui/v3/icons/FileStoresIcon';
import { DeleteFileStoreModal } from '@/features/orgs/projects/ai/DeleteFileStoreModal';
import { FileStoreForm } from '@/features/orgs/projects/ai/FileStoreForm';
import type { GraphiteFileStore } from '@/features/orgs/projects/ai/file-stores/types';
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
    <div className="flex flex-col">
      {fileStores.map((fileStore) => (
        <div
          key={fileStore.id}
          className="flex h-16 w-full items-center justify-between gap-4 border-b-1 px-4 py-2 transition-colors hover:bg-accent"
        >
          <button
            type="button"
            onClick={() => viewFileStore(fileStore)}
            className="flex min-w-0 flex-1 cursor-pointer flex-row items-center gap-4 text-left"
          >
            <FileStoresIcon className="h-5 w-5 flex-shrink-0" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold text-sm+">
                {fileStore.name ?? 'unset'}
              </span>
              <span className="hidden truncate font-mono text-muted-foreground text-xs md:inline">
                {fileStore.id}
              </span>
            </div>
          </button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(event) => {
              copy(fileStore.id, 'File Store Id');
              event.stopPropagation();
            }}
            aria-label="File Store Id"
            className="hidden h-8 w-8 flex-shrink-0 md:inline-flex"
          >
            <CopyIcon className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="More options"
                onClick={(event) => event.stopPropagation()}
              >
                <DotsHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto p-0">
              <DropdownMenuItem
                onClick={() => viewFileStore(fileStore)}
                className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
              >
                <EyeIcon className="h-4 w-4" />
                <span>View {fileStore.name}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                onClick={() => deleteFileStore(fileStore)}
              >
                <TrashIcon className="h-4 w-4" />
                <span>Delete {fileStore.name}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
