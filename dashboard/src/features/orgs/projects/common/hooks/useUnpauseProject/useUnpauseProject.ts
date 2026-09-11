import { useCallback } from 'react';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getUnpauseErrorMessage } from '@/features/orgs/utils/getUnpauseErrorMessage';
import {
  GetOrganizationsDocument,
  useUnpauseApplicationMutation,
} from '@/generated/graphql';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { useUserData } from '@/hooks/useUserData';

/**
 * Shared "wake up" (unpause) action, used by both the full-screen paused
 * state and the paused state shown on the Overview page, so the mutation,
 * tracking and refetch logic only lives in one place.
 */
export default function useUnpauseProject() {
  const { project, refetch: refetchProject } = useProject();
  const userData = useUserData();
  const track = useTrackEvent();

  const [unpauseApplication, { loading }] = useUnpauseApplicationMutation({
    variables: {
      appId: project?.id,
    },
    refetchQueries: [
      {
        query: GetOrganizationsDocument,
        variables: { userId: userData?.id },
      },
    ],
  });

  const handleTriggerUnpausing = useCallback(async () => {
    await execPromiseWithErrorToast(
      async () => {
        await unpauseApplication({ variables: { appId: project?.id } });
        track('Project Resumed');
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        await refetchProject();
      },
      {
        loadingMessage: 'Starting the project...',
        successMessage: 'The project has been started successfully.',
        errorMessage: getUnpauseErrorMessage,
      },
    );
  }, [unpauseApplication, project?.id, refetchProject, track]);

  return { handleTriggerUnpausing, loading };
}
