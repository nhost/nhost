import { useDialog } from '@/components/common/DialogProvider';
import { Box } from '@/components/ui/v2/Box';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { IconButton } from '@/components/ui/v2/IconButton';
import { CubeIcon } from '@/components/ui/v2/icons/CubeIcon';
import { DotsHorizontalIcon } from '@/components/ui/v2/icons/DotsHorizontalIcon';
import { EmbeddingsIcon } from '@/components/ui/v2/icons/EmbeddingsIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { AutoEmbeddingsForm } from '@/features/orgs/projects/ai/AutoEmbeddingsForm';
import { DeleteAutoEmbeddingsModal } from '@/features/orgs/projects/ai/DeleteAutoEmbeddingsModal';
import { formatDistanceToNow } from 'date-fns';
import type { AutoEmbeddingsConfiguration } from 'pages/orgs/[orgSlug]/projects/[appSlug]/ai/auto-embeddings';

interface AutoEmbeddingsConfigurationsListProps {
  /**
   * The run services fetched from entering the users page.
   */
  autoEmbeddingsConfigurations: AutoEmbeddingsConfiguration[];

  /**
   * Function to be called after a submitting the form for either creating or updating a service.
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

export default function AutoEmbeddingsList({
  autoEmbeddingsConfigurations,
  onCreateOrUpdate,
  onDelete,
}: AutoEmbeddingsConfigurationsListProps) {
  const { openDrawer, openDialog, closeDialog } = useDialog();

  const viewAutoEmbeddingsConfiguration = async (
    autoEmbeddingsConfiguration: AutoEmbeddingsConfiguration,
  ) => {
    openDrawer({
      title: (
        <Box className="flex flex-row items-center space-x-2">
          <CubeIcon className="w-5 h-5" />
          <Text>Edit {autoEmbeddingsConfiguration?.name ?? 'unset'}</Text>
        </Box>
      ),
      component: (
        <AutoEmbeddingsForm
          autoEmbeddingsId={autoEmbeddingsConfiguration.id}
          initialData={{
            ...autoEmbeddingsConfiguration,
          }}
          onSubmit={() => onCreateOrUpdate()}
        />
      ),
    });
  };

  const deleteAutoEmbeddingsConfiguration = async (
    autoEmbeddingsConfiguration: AutoEmbeddingsConfiguration,
  ) => {
    openDialog({
      component: (
        <DeleteAutoEmbeddingsModal
          autoEmbeddingsConfiguration={autoEmbeddingsConfiguration}
          close={closeDialog}
          onDelete={onDelete}
        />
      ),
    });
  };

  return (
    <Box className="flex flex-col">
      {autoEmbeddingsConfigurations.map((autoEmbeddingsConfiguration) => (
        <Box
          key={autoEmbeddingsConfiguration.id}
          className="flex h-[64px] w-full cursor-pointer items-center justify-between space-x-4 border-b-1 px-4 py-2 transition-colors"
          sx={{
            [`&:hover`]: {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <Box
            onClick={() =>
              viewAutoEmbeddingsConfiguration(autoEmbeddingsConfiguration)
            }
            className="flex flex-row justify-between w-full"
            sx={{
              backgroundColor: 'transparent',
            }}
          >
            <div className="flex flex-row items-center flex-1 space-x-4">
              <EmbeddingsIcon className="w-5 h-5" />
              <div className="flex flex-col">
                <Text variant="h4" className="font-semibold">
                  {autoEmbeddingsConfiguration?.name ?? 'unset'}
                </Text>
                <Tooltip title={autoEmbeddingsConfiguration.updatedAt}>
                  <span className="hidden cursor-pointer text-sm text-slate-500 xs+:flex">
                    Updated{' '}
                    {formatDistanceToNow(
                      new Date(autoEmbeddingsConfiguration.updatedAt),
                    )}{' '}
                    ago
                  </span>
                </Tooltip>
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
                onClick={() =>
                  viewAutoEmbeddingsConfiguration(autoEmbeddingsConfiguration)
                }
                className="z-50 grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
              >
                <UserIcon className="w-4 h-4" />
                <Text className="font-medium">
                  View {autoEmbeddingsConfiguration?.name}
                </Text>
              </Dropdown.Item>
              <Divider component="li" />
              <Dropdown.Item
                className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                sx={{ color: 'error.main' }}
                onClick={() =>
                  deleteAutoEmbeddingsConfiguration(autoEmbeddingsConfiguration)
                }
              >
                <TrashIcon className="w-4 h-4" />
                <Text className="font-medium" color="error">
                  Delete {autoEmbeddingsConfiguration?.name}
                </Text>
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Root>
        </Box>
      ))}
    </Box>
  );
}
