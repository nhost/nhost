import { useCurrentWorkspaceAndApplication } from './useCurrentWorkspaceAndApplication';

export type UseAppCreatedAtReturn = {
  /**
   * The timestamp of the application creation in miliseconds.
   */
  appCreatedAt: number;
};

export function useAppCreatedAt(): UseAppCreatedAtReturn {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const appCreatedAt = new Date(currentApplication.createdAt).getTime();
  return { appCreatedAt };
}
