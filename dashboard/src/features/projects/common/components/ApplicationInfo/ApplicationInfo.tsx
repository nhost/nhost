import { Button } from '@/components/ui/v2/Button';
import { ArrowRightIcon } from '@/components/ui/v2/icons/ArrowRightIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  GetAllWorkspacesAndProjectsDocument,
  useDeleteApplicationMutation,
} from '@/generated/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { copy } from '@/utils/copy';
import { getServerError } from '@/utils/getServerError';
import { getApplicationStatusString } from '@/utils/helpers';
import { formatDistance } from 'date-fns';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';

export default function ApplicationInfo() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [deleteApplication] = useDeleteApplicationMutation({
    refetchQueries: [{ query: GetAllWorkspacesAndProjectsDocument }],
  });
  const router = useRouter();

  async function handleClickRemove() {
    try {
      await toast.promise(
        deleteApplication({ variables: { appId: currentProject.id } }),
        {
          loading: 'Deleting project...',
          success: 'The project has been deleted successfully.',
          error: getServerError(
            'An error occurred while deleting the project. Please try again.',
          ),
        },
        getToastStyleProps(),
      );

      await router.push('/');
    } catch {
      // Note: The toast will handle the error.
    }
  }

  if (!currentProject) {
    return null;
  }

  return (
    <div className="mt-4 grid grid-flow-row gap-4">
      <div className="grid grid-flow-row justify-center gap-0.5">
        <Text variant="subtitle2">Application ID:</Text>

        <Button
          variant="borderless"
          onClick={() => copy(currentProject.id, 'Application ID')}
          className="py-1 text-xs"
        >
          {currentProject.id}
        </Button>
      </div>

      <div className="grid grid-flow-row justify-center gap-0.5">
        <Text variant="subtitle2">Desired State:</Text>

        <Button
          variant="borderless"
          onClick={() =>
            copy(
              currentProject.desiredState.toString(),
              'Application Desired State',
            )
          }
          className="py-1 text-xs"
        >
          {getApplicationStatusString(currentProject.desiredState)}
        </Button>
      </div>

      <div className="grid grid-flow-row gap-0.5">
        <Text variant="subtitle2">Region:</Text>

        <Text variant="subtitle1">{currentProject.region.city}</Text>
      </div>

      <div className="grid grid-flow-row gap-0.5">
        <Text variant="subtitle2">Created:</Text>

        <Text variant="subtitle1">
          {formatDistance(new Date(currentProject.createdAt), new Date(), {
            addSuffix: true,
          })}
        </Text>
      </div>

      <div className="grid grid-flow-row gap-2">
        <Link
          href={`https://staging.nhost.run/console/data/default/schema/public/tables/app_state_history/browse?filter=app_id%3B%24eq%3B${currentProject.id}`}
          target="_blank"
          rel="noreferrer noopener"
          className="grid grid-flow-col items-center justify-center gap-1 p-2"
          underline="hover"
        >
          App State History <ArrowRightIcon />
        </Link>

        <Button color="error" variant="outlined" onClick={handleClickRemove}>
          Delete Project
        </Button>
      </div>
    </div>
  );
}
