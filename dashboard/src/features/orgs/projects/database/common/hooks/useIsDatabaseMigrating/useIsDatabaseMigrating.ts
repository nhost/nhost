import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  useGetApplicationStateQuery,
  type GetApplicationStateQuery,
  type GetApplicationStateQueryVariables,
} from '@/generated/graphql';
import { ApplicationStatus } from '@/types/application';
import type { QueryHookOptions } from '@apollo/client';
import { useVisibilityChange } from '@uidotdev/usehooks';
import { useEffect } from 'react';

export interface UseIsDatabaseMigratingOptions
  extends QueryHookOptions<
    GetApplicationStateQuery,
    GetApplicationStateQueryVariables
  > {
  shouldPoll?: boolean;
}

/*
 * This hook returns information about the current state of database migration.
 * @param options - Options for the query.
 *
 * @returns - An object with two properties:
 * - isMigrating: true if the database is currently migrating.
 * - shouldShowUpgradeLogs: true if the database is currently migrating or the application is not live after a migration.
 */
export default function useIsDatabaseMigrating(
  options: UseIsDatabaseMigratingOptions = {},
): {
  isMigrating: boolean;
  shouldShowUpgradeLogs: boolean;
} {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const isVisible = useVisibilityChange();

  const {
    data: appStatesData,
    startPolling,
    stopPolling,
  } = useGetApplicationStateQuery({
    ...options,
    variables: { ...options.variables, appId: currentProject?.id },
    skip: !currentProject,
    skipPollAttempt: () => !isVisible,
  });

  useEffect(() => {
    if (options.shouldPoll) {
      startPolling(options.pollInterval || 5000);
    }

    return () => stopPolling();
  }, [stopPolling, startPolling, options.shouldPoll, options.pollInterval]);

  // Return true if the application is migrating or if the application is not live after a migration
  const shouldShowUpgradeLogs = (
    appStates: GetApplicationStateQuery['app']['appStates'],
  ) => {
    for (let i = 0; i < appStates.length; i += 1) {
      if (appStates[i].stateId === ApplicationStatus.Live) {
        return false;
      }
      if (appStates[i].stateId === ApplicationStatus.Migrating) {
        return true;
      }
    }

    return false;
  };

  // Return true if the application is currently migrating
  const isMigrating = (
    appStates: GetApplicationStateQuery['app']['appStates'],
  ) => {
    for (let i = 0; i < appStates.length; i += 1) {
      if (appStates[i].stateId === ApplicationStatus.Live) {
        return false;
      }
      if (appStates[i].stateId === ApplicationStatus.Errored) {
        return false;
      }
      if (appStates[i].stateId === ApplicationStatus.Migrating) {
        return true;
      }
    }

    return false;
  };

  return {
    isMigrating: isMigrating(appStatesData?.app?.appStates || []),
    shouldShowUpgradeLogs: shouldShowUpgradeLogs(
      appStatesData?.app?.appStates || [],
    ),
  };
}
