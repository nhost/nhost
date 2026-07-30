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
import {
  AssistantForm,
  type AssistantFormInitialData,
} from '@/features/orgs/projects/ai/AssistantForm';
import type { Assistant } from '@/features/orgs/projects/ai/assistants/types';
import { DeleteAssistantModal } from '@/features/orgs/projects/ai/DeleteAssistantModal';
import type { GraphiteFileStore } from '@/features/orgs/projects/ai/file-stores/types';
import { copy } from '@/utils/copy';

interface AssistantsListProps {
  /**
   * The list of assistants
   */
  assistants: Assistant[];

  /**
   * The list of file stores
   */
  fileStores?: GraphiteFileStore[];

  /**
   * Function to be called after a submitting the form for either creating or updating an assistant.
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

export default function AssistantsList({
  assistants,
  fileStores,
  onCreateOrUpdate,
  onDelete,
}: AssistantsListProps) {
  const { openDrawer, openDialog, closeDialog } = useDialog();

  const viewAssistant = async (assistant: Assistant) => {
    openDrawer({
      title: `Edit ${assistant.name ?? 'unset'}`,
      component: (
        <AssistantForm
          assistantId={assistant.assistantID}
          initialData={assistant as AssistantFormInitialData}
          fileStores={fileStores}
          onSubmit={onCreateOrUpdate}
        />
      ),
    });
  };

  const deleteAssistant = async (assistant: Assistant) => {
    openDialog({
      component: (
        <DeleteAssistantModal
          assistant={assistant}
          close={closeDialog}
          onDelete={onDelete}
        />
      ),
    });
  };

  return (
    <div className="flex flex-col">
      {assistants.map((assistant) => (
        <div
          key={assistant.assistantID}
          className="flex h-16 w-full items-center justify-between gap-4 border-b-1 px-4 py-2 transition-colors hover:bg-accent"
        >
          <button
            type="button"
            onClick={() => viewAssistant(assistant)}
            className="flex min-w-0 flex-1 cursor-pointer flex-row items-center gap-4 text-left"
          >
            <span className="flex-shrink-0 text-3xl">🤖</span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold text-sm+">
                {assistant.name ?? 'unset'}
              </span>
              <span className="hidden truncate font-mono text-muted-foreground text-xs md:inline">
                {assistant.assistantID}
              </span>
            </div>
          </button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(event) => {
              copy(assistant.assistantID, 'Assistant Id');
              event.stopPropagation();
            }}
            aria-label="Assistant Id"
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
                onClick={() => viewAssistant(assistant)}
                className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
              >
                <EyeIcon className="h-4 w-4" />
                <span>View {assistant.name}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                onClick={() => deleteAssistant(assistant)}
              >
                <TrashIcon className="h-4 w-4" />
                <span>Delete {assistant.name}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
