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
import {
  AssistantForm,
  type AssistantFormInitialData,
} from '@/features/orgs/projects/ai/AssistantForm';
import { DeleteAssistantModal } from '@/features/orgs/projects/ai/DeleteAssistantModal';
import type { Assistant } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/ai/assistants';
import type { GraphiteFileStore } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/ai/file-stores';
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
      title: `Edit ${assistant?.name ?? 'unset'}`,
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
    <Box className="flex flex-col">
      {assistants.map((assistant) => (
        <Box
          key={assistant.assistantID}
          className="flex h-[64px] w-full cursor-pointer items-center justify-between space-x-4 border-b-1 px-4 py-2 transition-colors"
          sx={{
            [`&:hover`]: {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <Box
            onClick={() => viewAssistant(assistant)}
            className="flex w-full flex-row justify-between"
            sx={{ backgroundColor: 'transparent' }}
          >
            <div className="flex flex-1 flex-row items-center space-x-4">
              <span className="text-3xl">🤖</span>
              <div className="flex flex-col">
                <Text variant="h4" className="font-semibold">
                  {assistant?.name ?? 'unset'}
                </Text>
                <div className="hidden flex-row items-center space-x-2 md:flex">
                  <Text variant="subtitle1" className="font-mono text-xs">
                    {assistant.assistantID}
                  </Text>
                  <IconButton
                    variant="borderless"
                    color="secondary"
                    onClick={(event) => {
                      copy(assistant.assistantID, 'Assistant Id');
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
                onClick={() => viewAssistant(assistant)}
                className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
              >
                <EyeIcon className="h-4 w-4" />
                <span>View {assistant?.name}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                onClick={() => deleteAssistant(assistant)}
              >
                <TrashIcon className="h-4 w-4" />
                <span>Delete {assistant?.name}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Box>
      ))}
    </Box>
  );
}
