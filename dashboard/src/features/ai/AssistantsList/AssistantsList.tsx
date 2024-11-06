import { useDialog } from '@/components/common/DialogProvider';
import { Box } from '@/components/ui/v2/Box';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { IconButton } from '@/components/ui/v2/IconButton';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { DotsHorizontalIcon } from '@/components/ui/v2/icons/DotsHorizontalIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { Text } from '@/components/ui/v2/Text';
import { AssistantForm } from '@/features/ai/AssistantForm';
import { DeleteAssistantModal } from '@/features/ai/DeleteAssistantModal';
import { copy } from '@/utils/copy';
import { type Assistant } from 'pages/[workspaceSlug]/[appSlug]/ai/assistants';

interface AssistantsListProps {
  /**
   * The list of assistants.
   */
  assistants: Assistant[];

  /**
   * Function to be called after a submitting the form for either creating or updating an assistant.
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

export default function AssistantsList({
  assistants,
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
          initialData={{
            ...assistant,
          }}
          onSubmit={() => onCreateOrUpdate()}
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
                onClick={() => viewAssistant(assistant)}
                className="z-50 grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
              >
                <UserIcon className="h-4 w-4" />
                <Text className="font-medium">View {assistant?.name}</Text>
              </Dropdown.Item>
              <Divider component="li" />
              <Dropdown.Item
                className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                sx={{ color: 'error.main' }}
                onClick={() => deleteAssistant(assistant)}
              >
                <TrashIcon className="h-4 w-4" />
                <Text className="font-medium" color="error">
                  Delete {assistant?.name}
                </Text>
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Root>
        </Box>
      ))}
    </Box>
  );
}
