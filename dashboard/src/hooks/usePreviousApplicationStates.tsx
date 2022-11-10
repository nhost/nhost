import type { ApplicationStatus } from '@/types/application';
import { getPreviousApplicationState } from '@/utils/getPreviousApplicationState';
import { useGetApplicationStateQuery } from '@/utils/__generated__/graphql';
import { useEffect, useState } from 'react';
import useIsPlatform from './common/useIsPlatform';
import { useCurrentWorkspaceAndApplication } from './useCurrentWorkspaceAndApplication';

/**
 * This hook returns the previous application state (plus some checks.)
 */
export default function usePreviousApplicationState(): ApplicationStatus {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const isPlatform = useIsPlatform();
  const { data, loading, error } = useGetApplicationStateQuery({
    variables: { appId: currentApplication?.id },
    skip: !isPlatform,
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
