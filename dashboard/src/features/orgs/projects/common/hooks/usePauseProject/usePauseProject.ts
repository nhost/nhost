import { useCallback } from 'react';
import { useProjectStateChangePending } from '@/features/orgs/projects/common/hooks/useProjectStateChangePending';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getLockedProjectErrorMessage } from '@/features/orgs/utils/getLockedProjectErrorMessage';
import {
  GetOrganizationsDocument,
  usePauseApplicationMutation,
} from '@/generated/graphql';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { useUserData } from '@/hooks/useUserData';

/**
 * Shared "pause" action. `loading` stays true from the click until the project
 * actually leaves the Live state, so the button can show a spinner for the
 * whole wait instead of only while the mutation is in flight.
 */
export default function usePauseProject() {
  const { project, refetch: refetchProject } = useProject();
  const userData = useUserData();
  const track = useTrackEvent();

  const { isPending, startPending, stopPending } = useProjectStateChangePending();

  const [pauseApplication, { loading }] = usePauseApplicationMutation({
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

  const handleTriggerPausing = useCallback(async () => {
    startPending();

    await execPromiseWithErrorToast(
      async () => {
        await pauseApplication({ variables: { appId: project?.id } });
        track('Project Paused', { reason: 'manual' });
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        await refetchProject();
      },
      {
        loadingMessage: `Pausing ${project?.name}...`,
        successMessage: `${project?.name} will be paused, but please note that it may take some time to complete the process.`,
        errorMessage: getLockedProjectErrorMessage(
          `An error occurred while trying to pause the project "${project?.name}". Please try again.`,
        ),
        onError: stopPending,
      },
    );
  }, [
    pauseApplication,
    project?.id,
    project?.name,
    refetchProject,
    track,
    startPending,
    stopPending,
  ]);

  return { handleTriggerPausing, loading: loading || isPending };
}
