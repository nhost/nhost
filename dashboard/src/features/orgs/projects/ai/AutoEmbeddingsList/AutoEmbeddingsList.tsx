import { formatDistanceToNow } from 'date-fns';
import {
  BoxIcon,
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
import { EmbeddingsIcon } from '@/components/ui/v3/icons/EmbeddingsIcon';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import {
  AutoEmbeddingsForm,
  type AutoEmbeddingsInitialData,
} from '@/features/orgs/projects/ai/AutoEmbeddingsForm';
import type { AutoEmbeddingsConfiguration } from '@/features/orgs/projects/ai/auto-embeddings/types';
import { DeleteAutoEmbeddingsModal } from '@/features/orgs/projects/ai/DeleteAutoEmbeddingsModal';

interface AutoEmbeddingsConfigurationsListProps {
  /**
   * The run services fetched from entering the users page.
   */
  autoEmbeddingsConfigurations: AutoEmbeddingsConfiguration[];

  /**
   * Function to be called after a submitting the form for either creating or updating a service.
   */
  onCreateOrUpdate: () => Promise<unknown>;

  /**
   * Function to be called after a successful delete action.
   *
   */
  onDelete?: () => Promise<unknown>;
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
        <div className="flex flex-row items-center space-x-2">
          <BoxIcon className="h-5 w-5" />
          <span>Edit {autoEmbeddingsConfiguration.name ?? 'unset'}</span>
        </div>
      ),
      component: (
        <AutoEmbeddingsForm
          autoEmbeddingsId={autoEmbeddingsConfiguration.id}
          initialData={autoEmbeddingsConfiguration as AutoEmbeddingsInitialData}
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
    <div className="flex flex-col">
      {autoEmbeddingsConfigurations.map((autoEmbeddingsConfiguration) => (
        <div
          key={autoEmbeddingsConfiguration.id}
          className="flex h-16 w-full items-center justify-between gap-4 border-b-1 px-4 py-2"
        >
          <div className="flex min-w-0 flex-1 flex-row items-center gap-4">
            <EmbeddingsIcon className="h-5 w-5 flex-shrink-0" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold text-sm+">
                {autoEmbeddingsConfiguration.name ?? 'unset'}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="xs+:inline hidden truncate text-muted-foreground text-sm">
                    Updated{' '}
                    {formatDistanceToNow(
                      new Date(autoEmbeddingsConfiguration.updatedAt),
                    )}{' '}
                    ago
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {autoEmbeddingsConfiguration.updatedAt}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="More options"
              >
                <DotsHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto p-0">
              <DropdownMenuItem
                onClick={() =>
                  viewAutoEmbeddingsConfiguration(autoEmbeddingsConfiguration)
                }
                className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
              >
                <EyeIcon className="h-4 w-4" />
                <span>View {autoEmbeddingsConfiguration.name}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                onClick={() =>
                  deleteAutoEmbeddingsConfiguration(autoEmbeddingsConfiguration)
                }
              >
                <TrashIcon className="h-4 w-4" />
                <span>Delete {autoEmbeddingsConfiguration.name}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
