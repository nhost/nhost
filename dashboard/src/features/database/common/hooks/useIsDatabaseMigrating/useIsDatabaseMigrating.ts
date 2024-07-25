import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  useGetApplicationStateQuery,
  type GetApplicationStateQuery,
} from '@/generated/graphql';
import { ApplicationStatus } from '@/types/application';
import { useVisibilityChange } from '@uidotdev/usehooks';

/*
 * This hook returns true if the database is currently migrating or the application is not live after a migration.
 */
export default function useIsDatabaseMigrating(): boolean {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const isVisible = useVisibilityChange();

  const { data: appStatesData } = useGetApplicationStateQuery({
    variables: { appId: currentProject?.id },
    skip: !currentProject,
    pollInterval: 5000,
    skipPollAttempt: () => !isVisible,
  });

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

  return shouldShowUpgradeLogs(appStatesData?.app?.appStates || []);
}
