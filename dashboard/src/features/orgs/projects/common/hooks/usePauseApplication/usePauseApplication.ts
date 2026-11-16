import { useQueryClient } from '@tanstack/react-query';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getLockedProjectErrorMessage } from '@/features/orgs/utils/getLockedProjectErrorMessage';
import {
  GetOrganizationsDocument,
  usePauseApplicationMutation,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { analytics } from '@/lib/segment';

interface UsePauseApplicationReturn {
  onPause: () => Promise<void>;
  loading: boolean;
}

export default function usePauseApplication(): UsePauseApplicationReturn {
  const { project } = useAppState();
  const queryClient = useQueryClient();
  const userData = useUserData();
  const { currentOrg } = useOrgs();

  const [pauseApplication, { loading }] = usePauseApplicationMutation({
    refetchQueries: [
      {
        query: GetOrganizationsDocument,
        variables: { userId: userData?.id },
      },
    ],
  });

  async function onPause() {
    if (!project) {
      return;
    }

    await execPromiseWithErrorToast(
      async () => {
        await pauseApplication({ variables: { appId: project.id } });
        analytics.track('Project Paused', {
          reason: 'manual',
          org_id: currentOrg?.id ?? null,
          project_id: project.id,
        });

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['projectWithState', project.subdomain],
            exact: true,
          }),
          queryClient.invalidateQueries({
            queryKey: ['project', project.subdomain],
            exact: true,
          }),
        ]);
      },
      {
        loadingMessage: `Pausing ${project.name}...`,
        successMessage: `${project.name} will be paused, but please note that it may take some time to complete the process.`,
        errorMessage: getLockedProjectErrorMessage(
          `An error occurred while trying to pause the project "${project.name}". Please try again.`,
        ),
      },
    );
  }

  return { onPause, loading };
}
