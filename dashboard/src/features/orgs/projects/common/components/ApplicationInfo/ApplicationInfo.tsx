import { Button } from '@/components/ui/v2/Button';
import { ArrowRightIcon } from '@/components/ui/v2/icons/ArrowRightIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  GetAllWorkspacesAndProjectsDocument,
  useDeleteApplicationMutation,
} from '@/generated/graphql';
import { copy } from '@/utils/copy';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { getApplicationStatusString } from '@/utils/helpers';
import { formatDistance } from 'date-fns';
import { useRouter } from 'next/router';

export default function ApplicationInfo() {
  const { project } = useProject();
  const [deleteApplication] = useDeleteApplicationMutation({
    refetchQueries: [{ query: GetAllWorkspacesAndProjectsDocument }],
  });
  const router = useRouter();

  async function handleClickRemove() {
    await execPromiseWithErrorToast(
      async () => {
        await deleteApplication({ variables: { appId: project.id } });
        await router.push('/');
      },
      {
        loadingMessage: 'Deleting project...',
        successMessage: 'The project has been deleted successfully.',
        errorMessage:
          'An error occurred while deleting the project. Please try again.',
      },
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="grid grid-flow-row gap-4 mt-4">
      <div className="grid grid-flow-row justify-center gap-0.5">
        <Text variant="subtitle2">Application ID:</Text>

        <Button
          variant="borderless"
          onClick={() => copy(project.id, 'Application ID')}
          className="py-1 text-xs"
        >
          {project.id}
        </Button>
      </div>

      <div className="grid grid-flow-row justify-center gap-0.5">
        <Text variant="subtitle2">Desired State:</Text>

        <Button
          variant="borderless"
          onClick={() =>
            copy(project.desiredState.toString(), 'Application Desired State')
          }
          className="py-1 text-xs"
        >
          {getApplicationStatusString(project.desiredState)}
        </Button>
      </div>

      <div className="grid grid-flow-row gap-0.5">
        <Text variant="subtitle2">Region:</Text>

        <Text variant="subtitle1">{project.region.city}</Text>
      </div>

      <div className="grid grid-flow-row gap-0.5">
        <Text variant="subtitle2">Created:</Text>

        <Text variant="subtitle1">
          {formatDistance(new Date(project.createdAt), new Date(), {
            addSuffix: true,
          })}
        </Text>
      </div>

      <div className="grid grid-flow-row gap-2">
        <Link
          href={`https://staging.nhost.run/console/data/default/schema/public/tables/app_state_history/browse?filter=app_id%3B%24eq%3B${project.id}`}
          target="_blank"
          rel="noreferrer noopener"
          className="grid items-center justify-center grid-flow-col gap-1 p-2"
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
