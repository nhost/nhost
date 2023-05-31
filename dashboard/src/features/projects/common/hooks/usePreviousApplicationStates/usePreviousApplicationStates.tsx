import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { getPreviousApplicationState } from '@/features/projects/common/utils/getPreviousApplicationState';
import type { ApplicationStatus } from '@/types/application';
import { useGetApplicationStateQuery } from '@/utils/__generated__/graphql';
import { useEffect, useState } from 'react';

/**
 * This hook returns the previous application state (plus some checks.)
 */
export default function usePreviousApplicationState(): ApplicationStatus {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const isPlatform = useIsPlatform();
  const { data, loading, error } = useGetApplicationStateQuery({
    variables: { appId: currentProject?.id },
    skip: !isPlatform || !currentProject?.id,
  });

  const [previousState, setPreviousState] = useState<ApplicationStatus | null>(
    null,
  );

  useEffect(() => {
    if (loading) {
      return;
    }
    if (error) {
      return;
    }

    if (data?.app?.appStates) {
      const previousAcceptedState = getPreviousApplicationState(
        data.app.appStates,
      );

      setPreviousState(previousAcceptedState);
    }
  }, [setPreviousState, data, loading, error]);

  return previousState;
}
