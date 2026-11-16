import { useMutation, useQueryClient } from '@tanstack/react-query';
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

  const [unpauseApplication] = useUnpauseApplicationMutation();
  const { mutateAsync: unpause, isPending: loading } = useMutation(async () => {
    if (!project) {
      return;
    }

    await unpauseApplication({
      variables: { appId: project.id },
      refetchQueries: [
        {
          query: GetOrganizationsDocument,
          variables: { userId: userData?.id },
        },
      ],
      awaitRefetchQueries: true,
    });

    analytics.track('Project Resumed', {
      org_id: currentOrg?.id ?? null,
      project_id: project.id,
    });

    await Promise.all([
      queryClient.refetchQueries(
        {
          queryKey: ['projectWithState', project.subdomain],
          exact: true,
        },
        { throwOnError: true },
      ),
      queryClient.refetchQueries(
        {
          queryKey: ['project', project.subdomain],
          exact: true,
        },
        { throwOnError: true },
      ),
    ]);
  });

  async function onUnpause() {
    if (!project) {
      return;
    }

    await execPromiseWithErrorToast(unpause, {
      loadingMessage: 'Starting the project...',
      successMessage: 'The project has been started successfully.',
      errorMessage: getUnpauseErrorMessage,
    });
  }

  return { onUnpause, loading };
}
