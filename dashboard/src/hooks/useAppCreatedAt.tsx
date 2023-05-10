import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';

export type UseAppCreatedAtReturn = {
  /**
   * The timestamp of the application creation in miliseconds.
   */
  appCreatedAt: number;
};

export function useAppCreatedAt(): UseAppCreatedAtReturn {
  const { currentProject } = useCurrentWorkspaceAndProject();

  return { appCreatedAt: new Date(currentProject.createdAt).getTime() };
}
