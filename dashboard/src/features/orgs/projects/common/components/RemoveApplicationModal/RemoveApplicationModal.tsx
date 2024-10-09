import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { Divider } from '@/components/ui/v2/Divider';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { triggerToast } from '@/utils/toast';
import {
  GetAllWorkspacesAndProjectsDocument,
  useDeleteApplicationMutation,
} from '@/utils/__generated__/graphql';
import router from 'next/router';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface RemoveApplicationModalProps {
  /**
   * Call this function to imperatively close the modal.
   */
  close: any;
  /**
   * A custom function to be run instead of the own handle function defined by the component.
   */
  handler?: any;
  /**
   * The title of the modal.
   */
  title?: string;
  /**
   * Description of the modal
   */
  description?: string;
  /**
   * Class name to be applied to the modal.
   */
  className?: string;
}

export default function RemoveApplicationModal({
  close,
  handler,
  title,
  description,
  className,
}: RemoveApplicationModalProps) {
  const [deleteApplication] = useDeleteApplicationMutation({
    refetchQueries: [{ query: GetAllWorkspacesAndProjectsDocument }],
  });
  const [loadingRemove, setLoadingRemove] = useState(false);
  const { currentProject } = useCurrentWorkspaceAndProject();

  const [remove, setRemove] = useState(false);
  const [remove2, setRemove2] = useState(false);
  const appName = currentProject?.name;

  async function handleClick() {
    setLoadingRemove(true);

    if (handler) {
      await handler();
      setLoadingRemove(false);
      if (close) {
        close();
      }
      return;
    }

    try {
      await deleteApplication({
        variables: {
          appId: currentProject.id,
        },
      });
    } catch (error) {
      await discordAnnounce(`Error trying to delete project: ${appName}`);
    }
    close();
    await router.push('/');
    triggerToast(`${currentProject.name} deleted`);
  }

  return (
    <Box
      className={twMerge('w-full max-w-sm rounded-lg p-6 text-left', className)}
    >
      <div className="grid grid-flow-row gap-1">
        <Text variant="h3" component="h2">
          {title || 'Delete Project'}
        </Text>

        <Text variant="subtitle2">
          {description || 'Are you sure you want to delete this app?'}
        </Text>

        <Text
          variant="subtitle2"
          className="font-bold"
          sx={{ color: (theme) => `${theme.palette.error.main} !important` }}
        >
          This cannot be undone.
        </Text>

        <Box className="my-4 border-y">
          <Checkbox
            id="accept-1"
            label={`I'm sure I want to delete ${appName}`}
            className="py-2"
            checked={remove}
            onChange={(_event, checked) => setRemove(checked)}
            aria-label="Confirm Delete Project #1"
          />

          <Divider />

          <Checkbox
            id="accept-2"
            label="I understand this action cannot be undone"
            className="py-2"
            checked={remove2}
            onChange={(_event, checked) => setRemove2(checked)}
            aria-label="Confirm Delete Project #2"
          />
        </Box>

        <div className="grid grid-flow-row gap-2">
          <Button
            color="error"
            onClick={handleClick}
            disabled={!remove || !remove2}
            loading={loadingRemove}
          >
            Delete Project
          </Button>

          <Button variant="outlined" color="secondary" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </Box>
  );
}
