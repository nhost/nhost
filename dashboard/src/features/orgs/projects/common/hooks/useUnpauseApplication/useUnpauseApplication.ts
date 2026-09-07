import { useQueryClient } from '@tanstack/react-query';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getUnpauseErrorMessage } from '@/features/orgs/utils/getUnpauseErrorMessage';
import {
  GetOrganizationsDocument,
  useUnpauseApplicationMutation,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { analytics } from '@/lib/segment';

interface UseUnpauseApplicationReturn {
  onUnpause: () => Promise<void>;
  loading: boolean;
}

export default function useUnpauseApplication(): UseUnpauseApplicationReturn {
  const { project } = useAppState();
  const queryClient = useQueryClient();
  const userData = useUserData();
  const { currentOrg } = useOrgs();

  const [unpauseApplication, { loading }] = useUnpauseApplicationMutation({
    refetchQueries: [
      {
        query: GetOrganizationsDocument,
        variables: { userId: userData?.id },
      },
    ],
  });

  async function onUnpause() {
    if (!project) {
      return;
    }

    await execPromiseWithErrorToast(
      async () => {
        await unpauseApplication({ variables: { appId: project.id } });
        analytics.track('Project Resumed', {
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
        loadingMessage: 'Starting the project...',
        successMessage: 'The project has been started successfully.',
        errorMessage: getUnpauseErrorMessage,
      },
    );
  }

  return { onUnpause, loading };
}
