import { formatDistance } from 'date-fns';
import { ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetOrganizationsDocument,
  useBillingDeleteAppMutation,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { copy } from '@/utils/copy';
import { getApplicationStatusString } from '@/utils/helpers';

export default function ApplicationInfo() {
  const router = useRouter();
  const { project } = useProject();
  const { currentOrg: org } = useOrgs();
  const userData = useUserData();

  const [deleteApplication] = useBillingDeleteAppMutation({
    refetchQueries: [
      { query: GetOrganizationsDocument, variables: { userId: userData?.id } },
    ],
  });

  async function handleClickRemove() {
    await execPromiseWithErrorToast(
      async () => {
        await deleteApplication({
          variables: {
            appID: project?.id,
          },
        });

        await router.push(`/orgs/${org?.slug}/projects`);
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
    <div className="mt-4 grid grid-flow-row gap-4">
      <div className="grid grid-flow-row justify-center gap-0.5">
        <p className="text-muted-foreground text-xs">Application ID:</p>

        <Button
          variant="ghost"
          onClick={() => copy(project.id, 'Application ID')}
          className="h-auto py-1 text-primary text-xs"
        >
          {project.id}
        </Button>
      </div>

      <div className="grid grid-flow-row justify-center gap-0.5">
        <p className="text-muted-foreground text-xs">Desired State:</p>

        <Button
          variant="ghost"
          onClick={() =>
            copy(project.desiredState.toString(), 'Application Desired State')
          }
          className="h-auto py-1 text-primary text-xs"
        >
          {getApplicationStatusString(project.desiredState)}
        </Button>
      </div>

      <div className="grid grid-flow-row gap-0.5">
        <p className="text-muted-foreground text-xs">Region:</p>

        <p className="text-muted-foreground text-sm">{project.region.city}</p>
      </div>

      <div className="grid grid-flow-row gap-0.5">
        <p className="text-muted-foreground text-xs">Created:</p>

        <p className="text-muted-foreground text-sm">
          {formatDistance(new Date(project.createdAt), new Date(), {
            addSuffix: true,
          })}
        </p>
      </div>

      <div className="grid grid-flow-row gap-2">
        <Link
          href={`https://staging.nhost.run/console/data/default/schema/public/tables/app_state_history/browse?filter=app_id%3B%24eq%3B${project.id}`}
          target="_blank"
          rel="noreferrer noopener"
          className="grid grid-flow-col items-center justify-center gap-1 p-2 text-primary hover:underline"
        >
          App State History <ArrowRightIcon />
        </Link>

        <Button variant="destructive" onClick={handleClickRemove}>
          Delete Project
        </Button>
      </div>
    </div>
  );
}
