import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { MAX_FREE_PROJECTS } from '@/utils/constants/common';
import {
  useGetFreeAndActiveProjectsQuery,
  useGetProjectIsLockedQuery,
} from '@/utils/__generated__/graphql';
import { useUserData } from '@nhost/nextjs';

/**
 * This hook returns the reason why the application is paused.
 * It returns the locked reason and if the user has exceeded the number of free and live projects.
 */

export default function useAppPausedReason(): {
  isLocked: boolean;
  lockedReason: string | undefined;
  freeAndLiveProjectsNumberExceeded: boolean;
  loading: boolean;
} {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const user = useUserData();
  const { data, loading } = useGetFreeAndActiveProjectsQuery({
    variables: { userId: user?.id },
    skip: !user,
  });

  const { data: isLockedData } = useGetProjectIsLockedQuery({
    variables: { appId: currentProject.id },
    skip: !currentProject,
  });

  const isLocked = isLockedData?.app?.isLocked;
  const lockedReason = isLockedData?.app?.isLockedReason;

  const numberOfFreeAndLiveProjects = data?.freeAndActiveProjects.length || 0;
  const freeAndLiveProjectsNumberExceeded =
    numberOfFreeAndLiveProjects >= MAX_FREE_PROJECTS;

  return {
    isLocked,
    lockedReason,
    freeAndLiveProjectsNumberExceeded,
    loading,
  };
}
